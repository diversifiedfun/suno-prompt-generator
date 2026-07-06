// set-tab.js — the Set (multi-track playlist) tab controller. Split out of
// sidepanel.js so the guided-intake UI lives in a focused module. Owns stages
// A (intake), B (arc gate) and C (tracks + journey strip).
import { el, copyAndFlash, filterSelectOptions } from "./dom-utils.js";
import { GENRE_GROUPS } from "./knowledge.js";
import {
  getPreset,
  VIBES,
  THEMES,
  OCCASIONS,
  getOccasion,
  occasionSentence,
  blanksToPlanParams,
} from "./set-knowledge.js";
import {
  createSet,
  getAllSets,
  getSet,
  updateSet,
  deleteSet,
  getFormDraft,
  saveFormDraft,
} from "./set-storage.js";
import {
  planSet,
  generateTrack,
  contourWarnings,
  sparkline,
  estimateSet,
  phaseLabels,
  CREDITS_PER_TRACK,
  presetWritesLyrics,
  relativeAge,
  setProgress,
  nudgeBrief,
  motifTargets,
} from "./set-generator.js";
import { getSettings, getAllVibes } from "./storage.js";

let currentSetId = null;
const setGenres = new Set();
const $set = (id) => document.getElementById(id);
// True once the user has touched any intake control — so an async draft restore
// that resolves late can't clobber a fast first click.
let interacted = false;

// --- Guided-intake state (stage A) ---
const intake = {
  presetKey: "",
  runtimeMin: 60,
  trackLength: "standard",
  countOverride: null,
  blanks: {},
  theme: "",
  // Free-text set vibe (colors the SOUND) and feelings/mood, kept distinct from
  // the lyrics theme so the two axes the engine already separates are exposed.
  freeVibe: "",
  feelings: "",
};

const POOLS = { vibe: VIBES, theme: THEMES };

// Chosen set genres shown as removable chips.
function renderSetGenreChips() {
  const box = $set("set-genre-chips");
  box.textContent = "";
  for (const g of setGenres) {
    const chip = el("button", "chip on", `${g} ✕`);
    chip.type = "button";
    chip.title = "Remove";
    chip.addEventListener("click", () => {
      setGenres.delete(g);
      renderSetGenreChips();
      persistDraft();
    });
    box.appendChild(chip);
  }
}

// Populate the genre <select>: placeholder + grouped genres + custom entry.
function renderSetGenreOptions() {
  const sel = $set("set-genre-select");
  sel.textContent = "";
  sel.appendChild(new Option("＋ Add a genre…", ""));
  for (const { family, genres } of GENRE_GROUPS) {
    const og = document.createElement("optgroup");
    og.label = family;
    for (const g of genres) og.appendChild(new Option(g, g));
    sel.appendChild(og);
  }
  sel.appendChild(new Option("✏️ Custom genre…", "__custom__"));
  sel.addEventListener("change", () => {
    const v = sel.value;
    sel.value = "";
    if (!v) return;
    if (v === "__custom__") {
      const custom = (prompt("Type a genre:") || "").trim();
      if (custom) setGenres.add(custom);
    } else {
      setGenres.add(v);
    }
    renderSetGenreChips();
    persistDraft();
  });
}

// Occasion cards in two labeled groups; each card is one preset.
function renderOccasions() {
  const box = $set("set-occasions");
  box.textContent = "";
  for (const group of [
    { key: "move", label: "Move" },
    { key: "calm", label: "Calm / Focus" },
  ]) {
    const heading = el("div", "occasion-grid-label", group.label);
    heading.style.gridColumn = "1 / -1";
    box.appendChild(heading);
    for (const occ of OCCASIONS.filter((o) => o.group === group.key)) {
      const card = el("button", "occasion-card");
      card.type = "button";
      card.dataset.key = occ.presetKey;
      card.append(el("span", "emoji", occ.emoji), el("span", "", occ.label));
      card.classList.toggle("on", intake.presetKey === occ.presetKey);
      card.addEventListener("click", () => selectOccasion(occ.presetKey));
      box.appendChild(card);
    }
  }
}

function selectOccasion(presetKey) {
  intake.presetKey = presetKey;
  intake.blanks = {}; // reseed defaults for the new occasion
  for (const c of $set("set-occasions").children)
    if (c.dataset && c.dataset.key)
      c.classList.toggle("on", c.dataset.key === presetKey);
  renderMadlib();
  renderPresetSubchoices();
  renderLyricWarn();
  persistDraft();
}

function currentRuntimeMin() {
  if (intake.runtimeMin === "custom")
    return Math.max(
      5,
      Math.min(600, Number($set("set-runtime-custom").value) || 60),
    );
  return intake.runtimeMin;
}

function currentCount() {
  if (Number.isFinite(intake.countOverride) && intake.countOverride >= 3)
    return Math.min(60, intake.countOverride);
  return estimateSet({
    runtimeMin: currentRuntimeMin(),
    trackLength: intake.trackLength,
  }).trackCount;
}

function renderCreditEstimate() {
  const count = currentCount();
  const credits = count * CREDITS_PER_TRACK;
  const line = $set("set-credit-est");
  line.textContent = `≈ ${count} tracks ≈ ~${credits} credits`;
  line.classList.toggle("warn", count > 20);
  if (count > 20) line.textContent += " — that's a big set";
}

function wireLengthDials() {
  $set("set-runtime").addEventListener("click", (e) => {
    const btn = e.target.closest(".dial-btn");
    if (!btn) return;
    for (const b of $set("set-runtime").querySelectorAll(".dial-btn"))
      b.classList.remove("active");
    btn.classList.add("active");
    const v = btn.dataset.min;
    intake.runtimeMin = v === "custom" ? "custom" : Number(v);
    $set("set-runtime-custom").classList.toggle("hidden", v !== "custom");
    renderCreditEstimate();
    persistDraft();
  });
  $set("set-runtime-custom").addEventListener("input", () => {
    renderCreditEstimate();
    persistDraft();
  });
  $set("set-tracklen").addEventListener("click", (e) => {
    const btn = e.target.closest(".dial-btn");
    if (!btn) return;
    for (const b of $set("set-tracklen").querySelectorAll(".dial-btn"))
      b.classList.remove("active");
    btn.classList.add("active");
    intake.trackLength = btn.dataset.len;
    renderCreditEstimate();
    persistDraft();
  });
  $set("set-count-override").addEventListener("input", (e) => {
    const n = Number(e.target.value);
    intake.countOverride = Number.isFinite(n) && n >= 3 ? n : null;
    renderCreditEstimate();
    persistDraft();
  });
}

// Render the mad-libs sentence for the chosen occasion; each blank is a pre-filled
// editable field. Focusing a blank shows its pool as pickable suggestion chips
// (blank boxes kill creative-tool UX — offer options). Blank values live in
// intake.blanks (seeded from the template so nothing is ever empty).
function renderMadlib() {
  const box = $set("set-madlib");
  const chipBox = $set("set-madlib-chips");
  box.textContent = "";
  chipBox.textContent = "";
  if (!intake.presetKey) {
    box.textContent = "Pick an occasion above to start.";
    return;
  }
  const tmpl = occasionSentence(getPreset(intake.presetKey));
  for (const part of tmpl.parts) {
    if (typeof part === "string") {
      box.appendChild(document.createTextNode(part));
      continue;
    }
    if (intake.blanks[part.slot] == null)
      intake.blanks[part.slot] = part.default;
    const input = document.createElement("input");
    input.className = "blank";
    input.value = intake.blanks[part.slot];
    input.size = Math.max(6, String(intake.blanks[part.slot]).length);
    input.dataset.slot = part.slot;
    input.dataset.pool = part.pool;
    input.addEventListener("input", () => {
      intake.blanks[part.slot] = input.value;
      input.size = Math.max(6, input.value.length);
      persistDraft();
    });
    input.addEventListener("focus", () => renderMadlibChips(part.pool, input));
    box.appendChild(input);
  }
}

// Suggestion chips for the focused blank; tapping one fills that blank.
function renderMadlibChips(pool, input) {
  const chipBox = $set("set-madlib-chips");
  chipBox.textContent = "";
  for (const word of POOLS[pool] || []) {
    const chip = el("button", "chip", word);
    chip.type = "button";
    chip.addEventListener("mousedown", (e) => {
      e.preventDefault(); // keep focus off the button so the input stays targeted
      input.value = word;
      input.size = Math.max(6, word.length);
      intake.blanks[input.dataset.slot] = word;
      persistDraft();
    });
    chipBox.appendChild(chip);
  }
}

// Always-visible lyrics-theme control: THEMES chips (single-select) + free text,
// shared across ALL occasions (Task 2 pulled theme out of the mad-libs sentence).
// A theme on an already-vocal preset needs no forcing; on an instrumental preset
// it flips writesLyrics via forceLyrics computed in onPlanSet.
function renderThemeControl() {
  const chipBox = $set("set-theme-chips");
  const text = $set("set-theme-text");
  chipBox.textContent = "";
  for (const word of THEMES) {
    const chip = el("button", "chip", word);
    chip.type = "button";
    chip.classList.toggle("on", intake.theme === word);
    chip.addEventListener("click", () => {
      intake.theme = intake.theme === word ? "" : word;
      text.value = intake.theme;
      renderThemeControl();
      renderLyricWarn();
      persistDraft();
    });
    chipBox.appendChild(chip);
  }
  text.value = intake.theme;
}

// Toggle chip highlighting only (no text.value write) so free typing never
// fights the input's own cursor position.
function syncThemeChipHighlight() {
  for (const chip of $set("set-theme-chips").children)
    chip.classList.toggle("on", intake.theme === chip.textContent);
}

// Feelings / mood — VIBES suggestion chips that APPEND into the free-text field
// (comma-separated). Feeds vibe[] (sound/feel), kept separate from lyrics theme.
function renderFeelingsControl() {
  const chipBox = $set("set-feelings-chips");
  const text = $set("set-feelings-text");
  chipBox.textContent = "";
  for (const word of VIBES) {
    const chip = el("button", "chip", word);
    chip.type = "button";
    chip.addEventListener("click", () => {
      const parts = text.value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (!parts.includes(word)) parts.push(word);
      text.value = parts.join(", ");
      intake.feelings = text.value;
      persistDraft();
    });
    chipBox.appendChild(chip);
  }
  text.value = intake.feelings;
}

// Saved-vibe chips at the top of the Set tab. Clicking one loads its reference
// into the set-vibe box and its subject into the lyrics theme.
async function renderSetSavedVibes() {
  const box = $set("set-vibe-saved");
  box.textContent = "";
  let vibes = [];
  try {
    vibes = await getAllVibes();
  } catch (err) {
    console.warn("Load vibes failed:", err);
  }
  for (const v of vibes.slice(0, 12)) {
    const label = v.name || v.reference.slice(0, 24) || "vibe";
    const chip = el("button", "chip", `📎 ${label}`);
    chip.type = "button";
    chip.title = "Load this saved vibe";
    chip.addEventListener("click", () => loadSavedVibeIntoSet(v));
    box.appendChild(chip);
  }
}

function loadSavedVibeIntoSet(v) {
  intake.freeVibe = v.reference || "";
  $set("set-vibe-text").value = intake.freeVibe;
  if (v.subject) {
    intake.theme = v.subject;
    renderThemeControl();
    renderLyricWarn();
  }
  persistDraft();
}

// Shows the preset's lyricWarn (e.g. Deep Focus) only when the user has actually
// typed a theme on an instrumental preset — otherwise there's nothing to warn about.
function renderLyricWarn() {
  const warn = $set("set-lyric-warn");
  const preset = getPreset(intake.presetKey);
  const msg = preset && preset.lyricWarn;
  const show = !!msg && !!intake.theme.trim();
  warn.textContent = show ? "⚠ " + msg : "";
  warn.classList.toggle("hidden", !show);
}

function renderPresetSubchoices() {
  const box = $set("set-subchoices");
  box.textContent = "";
  const p = getPreset(intake.presetKey);
  if (!p) return;
  for (const sc of p.subChoices || []) {
    box.appendChild(el("p", "field-label", sc.prompt));
    sc.options.forEach((optText, i) => {
      const wrap = document.createElement("label");
      wrap.style.display = "block";
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `sc-${sc.key}`;
      radio.value = optText;
      if (i === 0) radio.checked = true;
      radio.addEventListener("change", persistDraft);
      wrap.append(radio, document.createTextNode(" " + optText));
      box.appendChild(wrap);
    });
  }
}

function collectSubChoices(preset) {
  const out = {};
  for (const sc of (preset && preset.subChoices) || []) {
    const checked = document.querySelector(
      `input[name="sc-${sc.key}"]:checked`,
    );
    if (checked) out[sc.key] = checked.value;
  }
  return out;
}

export function renderSetTab() {
  if ($set("set-occasions").dataset.init) return;
  $set("set-occasions").dataset.init = "1";
  renderOccasions();
  wireLengthDials();
  renderSetGenreOptions();
  $set("set-genre-filter").addEventListener("input", (e) =>
    filterSelectOptions($set("set-genre-select"), e.target.value),
  );
  $set("set-plan").addEventListener("click", onPlanSet);
  renderCreditEstimate();
  renderMadlib();
  renderThemeControl();
  renderLyricWarn();
  $set("set-theme-text").addEventListener("input", (e) => {
    intake.theme = e.target.value;
    syncThemeChipHighlight();
    renderLyricWarn();
    persistDraft();
  });
  renderFeelingsControl();
  renderSetSavedVibes();
  $set("set-vibe-text").addEventListener("input", (e) => {
    intake.freeVibe = e.target.value;
    persistDraft();
  });
  $set("set-feelings-text").addEventListener("input", (e) => {
    intake.feelings = e.target.value;
    persistDraft();
  });
  renderMySets();
  restoreFormDraft();
}

// Browse/reopen saved sets. Sets already auto-persist on every createSet/
// updateSet, so this is a read-only list — no separate "Save" action.
async function renderMySets() {
  const list = $set("set-mysets-list");
  const summary = $set("set-mysets").querySelector("summary");
  const sets = await getAllSets();
  summary.textContent = `📁 My sets (${sets.length})`;
  list.textContent = "";
  if (!sets.length) {
    list.appendChild(el("p", "hint", "No saved sets yet."));
    return;
  }
  for (const s of sets) {
    const row = document.createElement("div");
    row.className = "myset-row";
    const info = document.createElement("div");
    info.className = "myset-info";
    info.appendChild(el("strong", "", s.title || "Untitled set"));
    info.appendChild(
      el(
        "span",
        "hint",
        `${s.tracks.length} tracks · ${relativeAge(s.createdAt)}`,
      ),
    );
    row.appendChild(info);

    const open = document.createElement("button");
    open.className = "btn";
    open.textContent = "Open";
    open.addEventListener("click", () => openSet(s.id));
    row.appendChild(open);

    const del = document.createElement("button");
    del.className = "btn";
    del.textContent = "🗑";
    del.title = "Delete";
    del.addEventListener("click", async () => {
      if (
        !confirm(`Delete "${s.title || "Untitled set"}"? This can't be undone.`)
      )
        return;
      await deleteSet(s.id);
      renderMySets();
    });
    row.appendChild(del);

    list.appendChild(row);
  }
}

// Reopen a saved set, restoring whichever stage it left off at: generated
// tracks → stage C, planned-but-not-generated → stage B, else stage A.
async function openSet(id) {
  const set = await getSet(id);
  if (!set) return;
  currentSetId = set.id;
  const hasGenerated = set.tracks.some((t) => t.status === "generated");
  if (hasGenerated) {
    showStage("c");
    renderTrackCards(set);
  } else if (set.tracks.length) {
    showStage("b");
    renderArcGate(set);
  } else {
    showStage("a");
  }
}

// Snapshot the current intake state so it can be re-saved on every change.
function readFormDraft() {
  return {
    presetKey: intake.presetKey,
    runtimeMin:
      intake.runtimeMin === "custom" ? currentRuntimeMin() : intake.runtimeMin,
    trackLength: intake.trackLength,
    trackCount: currentCount(),
    countOverride: intake.countOverride,
    blanks: { ...intake.blanks },
    theme: intake.theme,
    freeVibe: intake.freeVibe,
    feelings: intake.feelings,
    genres: [...setGenres],
    subChoices: collectSubChoices(getPreset(intake.presetKey)),
  };
}

// Fire-and-forget save; never blocks the UI. Also marks the form as touched so a
// late draft-restore won't overwrite what the user just did.
function persistDraft() {
  interacted = true;
  saveFormDraft(readFormDraft()).catch((e) =>
    console.warn("Set draft save failed:", e),
  );
}

// Restore the last-used intake so the flow is sticky across reopens.
async function restoreFormDraft() {
  let draft;
  try {
    draft = await getFormDraft();
  } catch {
    return;
  }
  if (!draft) return;
  if (interacted) return; // user already started — don't clobber their picks
  if (draft.presetKey && getPreset(draft.presetKey))
    intake.presetKey = draft.presetKey;
  if (Number.isFinite(draft.runtimeMin)) {
    intake.runtimeMin = [30, 60, 120].includes(draft.runtimeMin)
      ? draft.runtimeMin
      : "custom";
    if (intake.runtimeMin === "custom") {
      $set("set-runtime-custom").value = draft.runtimeMin;
      $set("set-runtime-custom").classList.remove("hidden");
    }
    for (const b of $set("set-runtime").querySelectorAll(".dial-btn"))
      b.classList.toggle("active", b.dataset.min === String(intake.runtimeMin));
  }
  if (["standard", "extended", "dj-long"].includes(draft.trackLength)) {
    intake.trackLength = draft.trackLength;
    for (const b of $set("set-tracklen").querySelectorAll(".dial-btn"))
      b.classList.toggle("active", b.dataset.len === draft.trackLength);
  }
  // Restore an explicit "exact track count" override (distinct from the derived
  // trackCount, which is just the estimate).
  if (Number.isFinite(draft.countOverride) && draft.countOverride >= 3) {
    intake.countOverride = draft.countOverride;
    $set("set-count-override").value = draft.countOverride;
  }
  intake.blanks =
    draft.blanks && typeof draft.blanks === "object" ? { ...draft.blanks } : {};
  intake.theme = typeof draft.theme === "string" ? draft.theme : "";
  intake.freeVibe = typeof draft.freeVibe === "string" ? draft.freeVibe : "";
  intake.feelings = typeof draft.feelings === "string" ? draft.feelings : "";
  $set("set-vibe-text").value = intake.freeVibe;
  setGenres.clear();
  for (const g of draft.genres || []) setGenres.add(g);
  renderSetGenreChips();
  renderOccasions();
  renderPresetSubchoices();
  renderMadlib();
  renderThemeControl();
  renderFeelingsControl();
  renderLyricWarn();
  renderCreditEstimate();
}

async function onPlanSet() {
  const preset = getPreset(intake.presetKey);
  if (!preset) {
    $set("set-status").textContent = "Pick an occasion first.";
    return;
  }
  const genres = [...setGenres];
  const trackCount = currentCount();
  const theme = intake.theme.trim();
  const forceLyrics = !!theme && !presetWritesLyrics(preset);
  // Base scene/vibe come from the occasion's mad-lib blanks; the explicit
  // free-vibe box and feelings field layer on top. Free vibe colors the SOUND
  // (→ scene); feelings are mood words (→ vibe[]). Neither touches the lyrics
  // theme, so the two axes stay separated exactly as the engine expects.
  const base = blanksToPlanParams(preset, intake.blanks);
  const freeVibe = intake.freeVibe.trim();
  const feelingsWords = intake.feelings
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const vibe = [...base.vibe, ...feelingsWords];
  const scene = [base.scene, freeVibe].filter(Boolean).join(", ");
  const occ = getOccasion(preset.key);
  const parts = [];
  if (genres.length) parts.push(`Genres: ${genres.join(", ")}`);
  if (freeVibe) parts.push(`Vibe: ${freeVibe}`);
  if (vibe.length) parts.push(`Feel: ${vibe.join(", ")}`);
  if (base.scene) parts.push(`Scene: ${base.scene}`);
  if (theme) parts.push(`About: ${theme}`);
  const concept = parts.join(". ");
  const subChoices = collectSubChoices(preset);
  const set = await createSet({
    title: `${preset.label} — ${(theme || freeVibe || (occ && occ.label) || "set").slice(0, 40)}`,
    presetKey: preset.key,
    maturity: preset.maturity,
    concept,
    subChoices,
    vibe,
    theme,
    forceLyrics,
    scene,
    story: "",
    genres,
    trackCount,
    trackLength: intake.trackLength,
    motif: "",
  });
  currentSetId = set.id;
  $set("set-status").textContent = "Planning…";
  const { apiKey, model } = await getSettings();
  const plan = await planSet({
    preset,
    concept,
    theme,
    forceLyrics,
    scene,
    story: "",
    genres,
    vibe,
    subChoices,
    conversation: [],
    trackCount,
    motif: "",
    apiKey,
    model,
  });
  await updateSet(set.id, {
    arcType: plan.arcType,
    contour: plan.contour,
    tracks: plan.briefs.map((b) => ({ brief: b, status: "planned" })),
    motif: plan.motif || "",
    offline: plan.offline || false,
    offlineNote: plan.offlineNote || "",
  });
  $set("set-status").textContent = "";
  showStage("b");
  renderArcGate(await getSet(set.id));
  renderMySets();
}

function showStage(which) {
  $set("set-stage-a").classList.toggle("hidden", which !== "a");
  $set("set-stage-b").classList.toggle("hidden", which !== "b");
  $set("set-stage-c").classList.toggle("hidden", which !== "c");
}

// Editable title bar shown on stages B/C — sets are always auto-persisted, so
// this is a rename-in-place, not a "Save" action.
function renderTitleBar(set) {
  const bar = document.createElement("div");
  bar.className = "myset-titlebar";
  const input = document.createElement("input");
  input.type = "text";
  input.value = set.title || "";
  input.className = "myset-title-input";
  input.addEventListener("change", async () => {
    await updateSet(currentSetId, { title: input.value });
    renderMySets();
  });
  const saved = el("span", "hint", "Saved ✓");
  bar.append(input, saved);
  return bar;
}

// Set-level recurring motif control — shows the plan's proposed motif (or a
// user-set one), editable; saves via updateSet on change.
function renderMotifControl(set) {
  const wrap = document.createElement("div");
  wrap.className = "set-motif";
  const label = el("label", "hint", "🔁 Recurring motif (opener + closer)");
  const input = document.createElement("input");
  input.type = "text";
  input.value = set.motif || "";
  input.placeholder = "A hook or lyric line that bookends the set…";
  input.className = "set-motif-input";
  input.addEventListener("change", async () => {
    await updateSet(currentSetId, { motif: input.value });
  });
  wrap.append(label, input);
  return wrap;
}

// Orchestrator — clears #set-stage-b and appends each helper's markup.
function renderArcGate(set) {
  const b = $set("set-stage-b");
  b.textContent = "";
  b.appendChild(renderTitleBar(set));
  b.appendChild(renderMotifControl(set));
  b.appendChild(renderContourRow(set));
  b.appendChild(renderBriefCards(set));
  b.appendChild(renderConversationPanel(set));
}

// Sparkline + numbers + ±1 contour warnings.
function renderContourRow(set) {
  const frag = document.createDocumentFragment();
  if (set.offline && set.offlineNote) {
    const note = el("div", "warn amber conv-line");
    note.textContent = "⚠ " + set.offlineNote;
    frag.appendChild(note);
  }
  const row = document.createElement("div");
  row.className = "contour-row";
  row.textContent = `${sparkline(set.contour)}   ${set.contour.join(" ")}`;
  frag.appendChild(row);
  for (const w of contourWarnings(set.contour)) {
    const p = document.createElement("p");
    p.className = "warn amber conv-line";
    p.textContent = "⚠ " + w;
    frag.appendChild(p);
  }
  return frag;
}

// Bump one track's energy (±1), re-deriving its bpm, and persist. Resets that
// track's status to "planned" so a later generate uses the new energy. Re-renders
// the arc gate so the sparkline + contourWarnings reflect the change live.
async function nudgeTrackEnergy(i, delta) {
  const s = await getSet(currentSetId);
  const preset = getPreset(s.presetKey);
  const tracks = s.tracks.map((t, idx) =>
    idx === i
      ? { ...t, brief: nudgeBrief(t.brief, delta, preset), status: "planned" }
      : t,
  );
  const contour = tracks.map((t) => t.brief.arcEnergy);
  await updateSet(currentSetId, { tracks, contour });
  renderArcGate(await getSet(currentSetId));
}

// Editable per-track brief cards with ↑/↓ reorder + hook input.
function renderBriefCards(set) {
  const frag = document.createDocumentFragment();
  set.tracks.forEach((t, i) => {
    const card = document.createElement("div");
    card.className = "brief-card";
    const head = document.createElement("strong");
    head.textContent = `#${i + 1} · energy ${t.brief.arcEnergy} · ${t.brief.bpmOrBeatless}`;
    card.appendChild(head);

    const hook = document.createElement("input");
    hook.type = "text";
    hook.value = t.brief.leadTexture;
    hook.className = "brief-hook";
    hook.addEventListener("change", async () => {
      const s = await getSet(currentSetId);
      const tracks = s.tracks.map((tt, idx) =>
        idx === i
          ? { ...tt, brief: { ...tt.brief, leadTexture: hook.value } }
          : tt,
      );
      await updateSet(currentSetId, { tracks });
    });
    card.append(document.createElement("br"), hook);

    const up = document.createElement("button");
    up.className = "btn";
    up.textContent = "↑";
    const down = document.createElement("button");
    down.className = "btn";
    down.textContent = "↓";
    up.addEventListener("click", () => reorderBrief(i, -1));
    down.addEventListener("click", () => reorderBrief(i, +1));

    const nudgeUp = document.createElement("button");
    nudgeUp.className = "btn nudge";
    nudgeUp.textContent = "▲";
    nudgeUp.title = "Bump this track's energy up";
    const nudgeDown = document.createElement("button");
    nudgeDown.className = "btn nudge";
    nudgeDown.textContent = "▼";
    nudgeDown.title = "Bump this track's energy down";
    nudgeUp.addEventListener("click", () => nudgeTrackEnergy(i, +1));
    nudgeDown.addEventListener("click", () => nudgeTrackEnergy(i, -1));

    card.append(up, down, nudgeUp, nudgeDown);
    frag.appendChild(card);
  });
  return frag;
}

// Conversation history + refine textarea + Re-plan/Generate-all buttons.
function renderConversationPanel(set) {
  const frag = document.createDocumentFragment();
  const conv = document.createElement("div");
  for (const m of set.conversation) {
    const line = document.createElement("p");
    line.className = `conv-line ${m.role === "user" ? "conv-user" : ""}`;
    line.textContent = `${m.role === "user" ? "You" : "Studio"}: ${m.text}`;
    conv.appendChild(line);
  }
  frag.appendChild(conv);

  const msg = document.createElement("textarea");
  msg.rows = 2;
  msg.placeholder =
    "Refine it: 'track 5 deeper', 'kill the vocals', 'this is a spa not a nap'…";
  const refine = document.createElement("button");
  refine.className = "btn";
  refine.textContent = "Refine";
  refine.addEventListener("click", () => onRefine(msg.value));

  const replan = document.createElement("button");
  replan.className = "btn";
  replan.textContent = "Re-plan from scratch";
  replan.addEventListener("click", () => onRefine("", true));

  const goGen = document.createElement("button");
  goGen.className = "btn primary";
  goGen.textContent = "Generate all tracks";
  goGen.addEventListener("click", async () =>
    startGenerateAll(await getSet(currentSetId)),
  );

  frag.append(msg, refine, replan, goGen);
  return frag;
}

async function reorderBrief(i, dir) {
  const s = await getSet(currentSetId);
  const j = i + dir;
  if (j < 0 || j >= s.tracks.length) return;
  const tracks = [...s.tracks];
  [tracks[i], tracks[j]] = [tracks[j], tracks[i]];
  const contour = tracks.map((t) => t.brief.arcEnergy);
  await updateSet(currentSetId, { tracks, contour });
  renderArcGate(await getSet(currentSetId));
}

async function onRefine(text, fromScratch = false) {
  const s = await getSet(currentSetId);
  const preset = getPreset(s.presetKey);
  const conversation = fromScratch
    ? []
    : [...s.conversation, { role: "user", text }];
  $set("set-status").textContent = "Refining…";
  const { apiKey, model } = await getSettings();
  const plan = await planSet({
    preset,
    concept: s.concept,
    theme: s.theme,
    scene: s.scene,
    story: s.story,
    genres: s.genres,
    vibe: s.vibe,
    subChoices: s.subChoices,
    conversation,
    // Keep the user's chosen length on refine/re-plan (else it reverts to 8).
    trackCount: s.trackCount || s.tracks.length,
    apiKey,
    model,
  });
  await updateSet(currentSetId, {
    arcType: plan.arcType,
    contour: plan.contour,
    tracks: plan.briefs.map((br) => ({ brief: br, status: "planned" })),
    // Re-plan can yield fewer tracks — reset the stepper so it never points past
    // the new array (which would crash "Paste next").
    activeTrackIndex: 0,
    conversation: [
      ...conversation,
      { role: "studio", text: "Updated the arc." },
    ],
    offline: plan.offline || false,
    offlineNote: plan.offlineNote || "",
  });
  $set("set-status").textContent = "";
  renderArcGate(await getSet(currentSetId));
}

async function startGenerateAll(set) {
  showStage("c");
  const c = $set("set-stage-c");
  c.textContent = "";
  const status = document.createElement("p");
  status.className = "settings-status";
  c.appendChild(status);
  const preset = getPreset(set.presetKey);
  const { apiKey, model } = await getSettings();
  const targets = motifTargets(set.tracks.length);

  const generated = [];
  for (let i = 0; i < set.tracks.length; i++) {
    status.textContent = `Generating track ${i + 1} of ${set.tracks.length}…`;
    const track = await generateTrack({
      preset,
      brief: set.tracks[i].brief,
      context: { theme: set.theme, vibe: set.vibe },
      trackLength: set.trackLength || "standard",
      forceLyrics: set.forceLyrics || false,
      motif: set.motif || "",
      isMotifTrack: targets.includes(i),
      apiKey,
      model,
    });
    generated.push({ ...set.tracks[i], ...track, status: "generated" });
    await updateSet(set.id, {
      tracks: [...generated, ...set.tracks.slice(i + 1)],
    });
  }
  status.textContent = "";
  renderTrackCards(await getSet(set.id));
}

// Read-only journey strip: an energy curve across the set with phase labels and a
// one-line "moment" per track (from the brief's leadTexture). Phase 2 makes it
// nudgeable.
function renderJourneyStrip(set) {
  const wrap = el("div", "journey-strip-wrap");
  wrap.appendChild(el("p", "section-head", "The journey"));
  const labels = phaseLabels(set.contour);
  const max = Math.max(1, ...set.contour);
  const strip = el("div", "journey-strip");
  set.contour.forEach((energy, i) => {
    const bar = el("div", "journey-bar");
    const fill = el("div", "bar");
    fill.style.height = `${Math.round((energy / max) * 44) + 4}px`;
    fill.title = `Track ${i + 1} · energy ${energy}`;
    bar.append(fill, el("div", "phase", labels[i] || ""));
    strip.appendChild(bar);
  });
  wrap.appendChild(strip);
  set.tracks.forEach((t, i) => {
    wrap.appendChild(
      el(
        "div",
        "journey-moment",
        `#${i + 1} ${labels[i] || ""} — ${t.brief.leadTexture}`,
      ),
    );
  });
  return wrap;
}

// Orchestrator — clears #set-stage-c and appends journey strip + stepper + cards.
// Resume tracker — a fill bar + "N/total pasted" summary above the track list.
function renderProgressRow(set) {
  const { pasted, total } = setProgress(set);
  const wrap = document.createElement("div");
  wrap.className = "set-progress";
  const fill = document.createElement("div");
  fill.className = "set-progress-fill";
  fill.style.width = `${total ? Math.round((pasted / total) * 100) : 0}%`;
  const label = document.createElement("span");
  label.className = "set-progress-label";
  label.textContent = `${pasted}/${total} pasted`;
  wrap.append(fill, label);
  return wrap;
}

function renderTrackCards(set) {
  const c = $set("set-stage-c");
  c.textContent = "";
  c.appendChild(renderTitleBar(set));
  c.appendChild(renderJourneyStrip(set));
  c.appendChild(renderStepper(set));
  c.appendChild(renderProgressRow(set));

  const copyAll = document.createElement("button");
  copyAll.className = "btn";
  copyAll.textContent = "Copy whole set";
  copyAll.addEventListener("click", () => {
    const text = set.tracks
      .map(
        (t, i) =>
          `#${i + 1} ${t.title || ""}\nSTYLE: ${t.style}\nEXCLUDE: ${t.exclude}\nBPM: ${t.bpmOrBeatless}\n${t.lyrics || t.structure}`,
      )
      .join("\n\n");
    copyAndFlash(copyAll, text);
  });
  c.appendChild(copyAll);

  set.tracks.forEach((t, i) => c.appendChild(buildTrackCard(set, t, i)));
}

// Stepper — active-track label + "Paste next → Suno".
function renderStepper(set) {
  const stepper = document.createElement("div");
  stepper.className = "stepper";
  const label = document.createElement("span");
  label.textContent = `Track ${set.activeTrackIndex + 1} of ${set.tracks.length}`;
  const pasteNext = document.createElement("button");
  pasteNext.className = "btn primary";
  pasteNext.textContent = "Paste next → Suno";
  pasteNext.addEventListener("click", async () => {
    const s = await getSet(currentSetId);
    await pasteIntoSuno(s.tracks[s.activeTrackIndex], s.activeTrackIndex);
    const next = Math.min(s.activeTrackIndex + 1, s.tracks.length - 1);
    await updateSet(currentSetId, { activeTrackIndex: next });
    renderTrackCards(await getSet(currentSetId));
  });
  stepper.append(label, pasteNext);
  return stepper;
}

// ✓ pasted / ● generated / ○ planned — the per-track resume state dot.
function trackStateDot(t) {
  if (t.pasted) return "✓";
  if (t.status === "generated" || t.status === "pasted") return "●";
  return "○";
}

// One track card: title/style/exclude/lyrics, each with its own Copy button, plus
// Regenerate/Paste. Title and lyrics are editable and persist. Clicking the head
// jumps the resume stepper to this track.
function buildTrackCard(set, t, i) {
  const card = document.createElement("div");
  card.className = "track-card";
  card.classList.toggle("active-track", i === set.activeTrackIndex);

  const head = document.createElement("strong");
  head.className = "track-state";
  head.textContent = `${trackStateDot(t)} #${i + 1} · ${t.bpmOrBeatless}`;
  head.title = "Jump to this track";
  head.style.cursor = "pointer";
  head.addEventListener("click", async () => {
    await updateSet(currentSetId, { activeTrackIndex: i });
    renderTrackCards(await getSet(currentSetId));
  });

  // Persist one field of this track immutably.
  const patchTrack = async (patch) => {
    const s = await getSet(currentSetId);
    const tracks = s.tracks.map((tt, idx) =>
      idx === i ? { ...tt, ...patch } : tt,
    );
    await updateSet(currentSetId, { tracks });
  };

  // Title — editable, persists, own copy.
  const titleWrap = el("div", "name-row");
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "track-title";
  titleInput.placeholder = "Song title";
  titleInput.value = t.title || "";
  titleInput.addEventListener("change", () =>
    patchTrack({ title: titleInput.value }),
  );
  const copyTitle = el("button", "btn", "Copy");
  copyTitle.addEventListener("click", () =>
    copyAndFlash(copyTitle, titleInput.value),
  );
  titleWrap.append(titleInput, copyTitle);

  // Style + its copy.
  const style = document.createElement("p");
  style.textContent = t.style || "";
  const copyStyle = el("button", "btn", "Copy style");
  copyStyle.addEventListener("click", () =>
    copyAndFlash(copyStyle, t.style || ""),
  );
  const styleRow = el("div", "btn-row");
  styleRow.appendChild(copyStyle);

  // Exclude (only when present) + its copy.
  const excFrag = document.createDocumentFragment();
  if (t.exclude) {
    const exc = document.createElement("p");
    exc.className = "hint";
    exc.textContent = `Exclude: ${t.exclude}`;
    const copyExc = el("button", "btn", "Copy exclude");
    copyExc.addEventListener("click", () => copyAndFlash(copyExc, t.exclude));
    const excRow = el("div", "btn-row");
    excRow.appendChild(copyExc);
    excFrag.append(exc, excRow);
  }

  // Lyrics — editable, persists, own copy.
  const lyricsLabel = el("div", "hint", "Lyrics");
  const lyricsBox = document.createElement("textarea");
  lyricsBox.className = "track-lyrics";
  lyricsBox.rows = 6;
  lyricsBox.value = t.lyrics || t.structure || "";
  lyricsBox.addEventListener("change", () =>
    patchTrack({ lyrics: lyricsBox.value }),
  );
  const copyLyrics = el("button", "btn", "Copy lyrics");
  copyLyrics.addEventListener("click", () =>
    copyAndFlash(copyLyrics, lyricsBox.value),
  );
  const lyricsRow = el("div", "btn-row");
  lyricsRow.appendChild(copyLyrics);

  const regen = el("button", "btn", "Regenerate");
  regen.addEventListener("click", () => regenerateOne(i));
  const paste = el("button", "btn primary", "Paste → Suno");
  // Re-fetch so any just-typed title/lyrics edits go across, even without blur.
  paste.addEventListener("click", async () => {
    const s = await getSet(currentSetId);
    await pasteIntoSuno(s.tracks[i], i);
  });
  const actions = el("div", "btn-row");
  actions.append(regen, paste);

  card.append(
    head,
    titleWrap,
    style,
    styleRow,
    excFrag,
    lyricsLabel,
    lyricsBox,
    lyricsRow,
    actions,
  );
  return card;
}

async function regenerateOne(i) {
  const s = await getSet(currentSetId);
  const preset = getPreset(s.presetKey);
  const { apiKey, model } = await getSettings();
  const track = await generateTrack({
    preset,
    brief: s.tracks[i].brief,
    context: { theme: s.theme, vibe: s.vibe },
    trackLength: s.trackLength || "standard",
    forceLyrics: s.forceLyrics || false,
    motif: s.motif || "",
    isMotifTrack: motifTargets(s.tracks.length).includes(i),
    apiKey,
    model,
  });
  const tracks = s.tracks.map((tt, idx) =>
    idx === i ? { ...tt, ...track, status: "generated" } : tt,
  );
  await updateSet(currentSetId, { tracks });
  renderTrackCards(await getSet(currentSetId));
}

// Fill the active Suno tab's Style + Lyrics fields via the content script.
// If the tab was open before the extension loaded, its content script is
// missing and sendMessage throws — we then inject suno-fill.js on the fly and
// retry, so paste is one-click even on a stale tab.
async function pasteIntoSuno(track, index) {
  const tabs = await chrome.tabs.query({ url: "https://suno.com/*" });
  if (!tabs.length) {
    $set("set-status").textContent = "Open a suno.com tab first.";
    return;
  }
  const tabId = tabs[0].id;
  const payload = {
    type: "suno-fill",
    title: track.title || "",
    style: track.style,
    lyrics: track.lyrics || track.structure,
  };
  let resp;
  try {
    resp = await chrome.tabs.sendMessage(tabId, payload);
  } catch {
    // No receiver — inject the content script, then retry once.
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["suno-fill.js"],
      });
      resp = await chrome.tabs.sendMessage(tabId, payload);
    } catch {
      $set("set-status").textContent =
        "Couldn't reach the Suno tab — reload suno.com and retry.";
      return;
    }
  }
  if (resp && resp.ok) {
    $set("set-status").textContent =
      `Pasted track ${index + 1} into Suno — hit Create there, then Paste next.`;
    chrome.tabs.update(tabId, { active: true });
    const s = await getSet(currentSetId);
    const tracks = s.tracks.map((tt, idx) =>
      idx === index ? { ...tt, pasted: true } : tt,
    );
    await updateSet(currentSetId, { tracks });
    renderTrackCards(await getSet(currentSetId));
  } else {
    $set("set-status").textContent =
      (resp && resp.error) || "Couldn't fill Suno's fields.";
  }
}
