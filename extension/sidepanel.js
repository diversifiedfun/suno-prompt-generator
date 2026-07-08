// sidepanel.js — four-tab UI controller.
// SECURITY: all user-supplied / AI-supplied text goes through textContent or
// createElement only. innerHTML is used only for static structural markup
// (no variable content ever interpolated into it). sourceUrl hrefs are
// guarded to http/https only. API key is never logged or written to DOM.

import {
  GENRES,
  GENRE_GROUPS,
  ERAS,
  MOODS,
  INSTRUMENTS,
  VOCALS,
  STRUCTURE_TAGS,
  VOICE_TAGS,
  DYNAMICS_TAGS,
  CONTRADICTIONS,
  EMPTY_WORDS,
  STYLE_SOFT_LIMIT,
  DESCRIPTOR_MIN,
  DESCRIPTOR_MAX,
} from "./knowledge.js";

import {
  generatePrompt,
  MODELS,
  buildStyleOptions,
  riffStyle,
  mergeRiff,
} from "./generator.js";
import { DEFAULT_MODEL } from "./constants.js";
import {
  addPrompt,
  getAllPrompts,
  updatePrompt,
  deletePrompt,
  getSettings,
  setSettings,
  getUiState,
  saveUiState,
  addVibe,
  getAllVibes,
  deleteVibe,
} from "./storage.js";
import {
  addGeneration,
  getAllGenerations,
  toggleStar,
  deleteGeneration,
  clearGenerations,
} from "./gen-history.js";

import {
  el,
  txt,
  copyAndFlash,
  safeHref,
  filterSelectOptions,
} from "./dom-utils.js";
import { driveSunoSliders, sliderPasteMessage } from "./suno-slider-driver.js";
import { renderSetTab } from "./set-tab.js";
import { renderAlbumTab } from "./album-tab.js";
import { renderWavTab } from "./wav-download.js";
import { attachAutocomplete } from "./autocomplete.js";
import { ARTISTS, VIBE_WORDS } from "./suggest-data.js";
import { relativeAge } from "./set-generator.js";

// ---------------------------------------------------------------------------
// Tab routing
// ---------------------------------------------------------------------------

const tabBtns = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

// Switch to a tab by name. Shared by user clicks and session restore so both
// paths stay in sync. `persist=false` is used during boot restore so replaying
// the saved tab doesn't immediately re-save it.
function activateTab(target, persist = true) {
  tabBtns.forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === target);
    b.setAttribute("aria-selected", String(b.dataset.tab === target));
  });
  tabPanels.forEach((p) => {
    p.classList.toggle("hidden", p.id !== `tab-${target}`);
  });
  // Refresh library when switching to it so captures show immediately.
  if (target === "library") renderLibrary();
  if (target === "set") renderSetTab();
  if (target === "album") renderAlbumTab();
  if (target === "wav") renderWavTab();
  if (persist) {
    uiState = { ...uiState, activeTab: target };
    persistUi();
  }
}

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

// ---------------------------------------------------------------------------
// Session UI state — the whole object is loaded at boot and re-saved (debounced)
// on every change, so reopening the panel lands where the user left off.
// Immutable: every mutation replaces uiState with a new object.
// ---------------------------------------------------------------------------

let uiState = {};
let persistTimer = null;
// Gate: no persistence until boot's restore has run, so the init calls that fire
// during startup (updateBuildPreview, etc.) can't overwrite the saved state with
// empty defaults before we've had a chance to read it back.
let booted = false;

function persistUi() {
  if (!booted) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    saveUiState(uiState).catch((e) =>
      console.warn("[Suno] UI state save failed:", e.message),
    );
  }, 250);
}

// Snapshot the Build tab's chip/select state into uiState. Called from
// updateBuildPreview (the chokepoint for every style change) and on lyrics edits.
// No-ops until boot's restore has run — otherwise the updateBuildPreview() call
// during startup would overwrite the loaded uiState.build with empty DOM values
// before restoreBuild() gets to read it.
function snapshotBuild() {
  if (!booted) return;
  uiState = {
    ...uiState,
    build: {
      name: document.getElementById("build-name")?.value ?? "",
      genre: buildState.genre,
      era: buildState.era,
      moods: [...buildState.moods],
      instruments: [...buildState.instruments],
      vocals: [...buildState.vocals],
      lyrics: document.getElementById("build-lyrics")?.value ?? "",
    },
  };
  persistUi();
}

// ---------------------------------------------------------------------------
// Library tab
// ---------------------------------------------------------------------------

async function renderLibrary() {
  const container = document.getElementById("library-list");
  const searchInput = document.getElementById("library-search");
  const query = (searchInput?.value ?? "").toLowerCase();
  container.textContent = ""; // clear safely

  let prompts;
  try {
    prompts = await getAllPrompts();
  } catch (err) {
    const errEl = el(
      "div",
      "empty-state",
      `Error loading prompts: ${err.message}`,
    );
    container.appendChild(errEl);
    return;
  }

  const filtered = prompts.filter((p) => {
    if (!query) return true;
    const haystack = [p.title, p.text, ...(p.tags || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });

  if (!filtered.length) {
    const msg = query
      ? "No prompts match your search."
      : 'No saved prompts yet.\nRight-click any selected text on a page and choose\n"Save selection as Suno prompt".';
    container.appendChild(el("div", "empty-state", msg));
    return;
  }

  filtered.forEach((prompt) => {
    container.appendChild(buildPromptCard(prompt));
  });
}

function buildPromptCard(prompt) {
  const card = el("div", "prompt-card");
  card.dataset.id = prompt.id;

  // Title or truncated text preview
  const titleEl = el("div", "prompt-card-title");
  titleEl.appendChild(
    txt(
      prompt.title ||
        prompt.text.slice(0, 80) + (prompt.text.length > 80 ? "…" : ""),
    ),
  );
  card.appendChild(titleEl);

  const textEl = el("div", "prompt-card-text");
  textEl.appendChild(txt(prompt.text));
  card.appendChild(textEl);

  // Tags
  if (prompt.tags?.length) {
    const tagsRow = el("div", "prompt-card-tags");
    prompt.tags.forEach((t) => {
      const tagEl = el("span", "prompt-card-tag");
      tagEl.appendChild(txt(t));
      tagsRow.appendChild(tagEl);
    });
    card.appendChild(tagsRow);
  }

  // Source link — guarded to http/https only
  if (prompt.sourceUrl) {
    const safe = safeHref(prompt.sourceUrl);
    const srcRow = el("div", "prompt-card-source");
    if (safe) {
      const a = document.createElement("a");
      a.href = safe;
      a.rel = "noopener noreferrer";
      a.target = "_blank";
      a.appendChild(txt("Source"));
      srcRow.appendChild(txt("From: "));
      srcRow.appendChild(a);
    } else {
      srcRow.appendChild(txt("Source URL hidden (unsafe scheme)"));
    }
    card.appendChild(srcRow);
  }

  // Action buttons
  const actions = el("div", "prompt-card-actions");
  const copyBtn = el("button", "btn", "Copy");
  copyBtn.addEventListener("click", () => copyAndFlash(copyBtn, prompt.text));

  const editBtn = el("button", "btn", "Edit");
  editBtn.addEventListener("click", () => toggleEditForm(card, prompt));

  const delBtn = el("button", "btn danger", "Delete");
  delBtn.addEventListener("click", () => handleDelete(card, prompt.id));

  actions.appendChild(copyBtn);
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  card.appendChild(actions);
  return card;
}

function toggleEditForm(card, prompt) {
  // Remove existing edit form if present (toggle)
  const existing = card.querySelector(".edit-form");
  if (existing) {
    existing.remove();
    return;
  }

  const form = el("div", "edit-form");

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "Title (optional)";
  titleInput.value = prompt.title || "";
  form.appendChild(titleInput);

  const tagsInput = document.createElement("input");
  tagsInput.type = "text";
  tagsInput.placeholder = "Tags (comma separated)";
  tagsInput.value = (prompt.tags || []).join(", ");
  form.appendChild(tagsInput);

  const saveBtn = el("button", "btn primary", "Save");
  saveBtn.addEventListener("click", async () => {
    try {
      const tags = tagsInput.value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      await updatePrompt(prompt.id, { title: titleInput.value.trim(), tags });
      await renderLibrary();
    } catch (err) {
      console.error("[Suno] Edit failed:", err.message);
    }
  });
  form.appendChild(saveBtn);
  card.appendChild(form);
}

async function handleDelete(card, id) {
  if (!confirm("Delete this prompt?")) return;
  try {
    await deletePrompt(id);
    card.remove();
  } catch (err) {
    console.error("[Suno] Delete failed:", err.message);
  }
}

document
  .getElementById("library-search")
  .addEventListener("input", renderLibrary);

// ---------------------------------------------------------------------------
// Build tab — chip state
// ---------------------------------------------------------------------------

const buildState = {
  genre: GENRES[0],
  era: ERAS[0],
  moods: new Set(),
  instruments: new Set(),
  vocals: new Set(),
};

// Render the genre <select>. With no family (or "__all__") it shows every family
// as an <optgroup>; with a family name it shows just that family's subgenres flat.
function renderGenreOptions(select, family) {
  select.textContent = "";
  const groups =
    !family || family === "__all__"
      ? GENRE_GROUPS
      : GENRE_GROUPS.filter((g) => g.family === family);
  const useGroups = groups.length > 1;
  for (const { family: fam, genres } of groups) {
    const target = useGroups
      ? Object.assign(document.createElement("optgroup"), { label: fam })
      : select;
    for (const g of genres) {
      const opt = document.createElement("option");
      opt.value = g;
      opt.textContent = g;
      target.appendChild(opt);
    }
    if (useGroups) select.appendChild(target);
  }
}

// Hide options (and empty <optgroup> families) that don't match the filter text.
// Matches on visible label so it works for any grouped select (genres, presets).
// Family → Genre cascade: a Family dropdown narrows the Genre dropdown; the
// "Custom" family swaps the Genre dropdown for a free-text box (Suno accepts
// made-up genres). A filter box narrows the visible genres further.
function setupGenreCascade(genreSelect) {
  const parent = genreSelect.parentNode;

  const family = document.createElement("select");
  family.id = "build-family";
  family.appendChild(new Option("All families", "__all__"));
  for (const g of GENRE_GROUPS)
    family.appendChild(new Option(g.family, g.family));
  family.appendChild(new Option("✏️ Custom genre…", "__custom__"));

  const filter = document.createElement("input");
  filter.type = "text";
  filter.id = "build-genre-filter";
  filter.className = "genre-filter";
  filter.placeholder = "Filter genres…";
  filter.autocomplete = "off";
  filter.addEventListener("input", () =>
    filterSelectOptions(genreSelect, filter.value),
  );

  const custom = document.createElement("input");
  custom.type = "text";
  custom.id = "build-genre-custom";
  custom.className = "genre-filter hidden";
  custom.placeholder = "Type your own genre…";
  custom.autocomplete = "off";
  custom.addEventListener("input", () => {
    buildState.genre = custom.value.trim();
    updateBuildPreview();
  });

  // Repurpose the existing "Genre" label as the "Family" label; add a fresh
  // "Genre" label above the genre select so the stack reads correctly.
  const familyLabel = parent.querySelector('label[for="build-genre"]');
  if (familyLabel) {
    familyLabel.textContent = "Family";
    familyLabel.setAttribute("for", "build-family");
  }
  const genreLabel = document.createElement("label");
  genreLabel.setAttribute("for", "build-genre");
  genreLabel.textContent = "Genre";

  // Order above the genre select: [Family label] Family, Filter, Genre label,
  // [Genre], then Custom after it.
  parent.insertBefore(family, genreSelect);
  parent.insertBefore(filter, genreSelect);
  parent.insertBefore(genreLabel, genreSelect);
  parent.insertBefore(custom, genreSelect.nextSibling);

  family.addEventListener("change", () => {
    const isCustom = family.value === "__custom__";
    genreSelect.classList.toggle("hidden", isCustom);
    genreLabel.classList.toggle("hidden", isCustom);
    filter.classList.toggle("hidden", isCustom);
    custom.classList.toggle("hidden", !isCustom);
    if (isCustom) {
      custom.focus();
      buildState.genre = custom.value.trim();
    } else {
      renderGenreOptions(genreSelect, family.value);
      filter.value = "";
      buildState.genre = genreSelect.value;
    }
    updateBuildPreview();
  });

  renderGenreOptions(genreSelect, "__all__");
  buildState.genre = genreSelect.value;
}

function initBuildSelects() {
  const genreSelect = document.getElementById("build-genre");

  if (!document.getElementById("build-family")) {
    setupGenreCascade(genreSelect);
  }

  genreSelect.addEventListener("change", () => {
    buildState.genre = genreSelect.value;
    updateBuildPreview();
  });

  const eraSelect = document.getElementById("build-era");
  ERAS.forEach((e) => {
    const opt = document.createElement("option");
    opt.value = e;
    opt.textContent = e;
    eraSelect.appendChild(opt);
  });
  eraSelect.addEventListener("change", () => {
    buildState.era = eraSelect.value;
    updateBuildPreview();
  });
}

// Renders multi-select chips for a grouped vocab object (MOODS, INSTRUMENTS, VOCALS).
function renderGroupedChips(containerId, vocab, stateSet) {
  const container = document.getElementById(containerId);
  Object.entries(vocab).forEach(([group, items]) => {
    const label = el("div", "group-label", group);
    container.appendChild(label);
    items.forEach((item) => {
      const chip = el("button", "chip", item);
      chip.type = "button";
      chip.addEventListener("click", () => {
        if (stateSet.has(item)) {
          stateSet.delete(item);
          chip.classList.remove("on");
        } else {
          stateSet.add(item);
          chip.classList.add("on");
        }
        updateBuildPreview();
      });
      container.appendChild(chip);
    });
  });
}

function initBuildChips() {
  renderGroupedChips("build-mood-chips", MOODS, buildState.moods);
  renderGroupedChips(
    "build-instrument-chips",
    INSTRUMENTS,
    buildState.instruments,
  );
  renderGroupedChips("build-vocal-chips", VOCALS, buildState.vocals);
}

function buildStyleString() {
  const parts = [
    buildState.genre,
    buildState.era,
    ...buildState.moods,
    ...buildState.instruments,
    ...buildState.vocals,
  ].filter(Boolean);
  return parts.join(", ");
}

function descriptorCount() {
  return (
    1 + // genre
    1 + // era
    buildState.moods.size +
    buildState.instruments.size +
    buildState.vocals.size
  );
}

// Escape regex metacharacters so future multi-word terms can't break the pattern.
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkContradictions(style) {
  const lower = ` ${style.toLowerCase()} `;
  return CONTRADICTIONS.filter(([a, b]) => {
    // Whole-word match via \b so "female vocals" ≠ "male vocals"
    const ra = new RegExp(`\\b${escapeRegex(a)}\\b`, "i");
    const rb = new RegExp(`\\b${escapeRegex(b)}\\b`, "i");
    return ra.test(lower) && rb.test(lower);
  });
}

function checkEmptyWords(style) {
  const lower = style.toLowerCase();
  return EMPTY_WORDS.filter((w) =>
    new RegExp(`\\b${escapeRegex(w)}\\b`, "i").test(lower),
  );
}

function updateBuildPreview() {
  const style = buildStyleString();
  const preview = document.getElementById("build-preview");
  const meta = document.getElementById("build-meta");
  const warningsEl = document.getElementById("build-warnings");

  preview.textContent = style || "(select genre, era, and descriptors above)";
  preview.classList.toggle("empty", !style);

  const count = descriptorCount();
  const charLen = style.length;

  // Meta row
  meta.textContent = "";
  const countSpan = el("span");
  countSpan.appendChild(txt(`${count} descriptors `));
  const countHint = el("span");
  if (count < DESCRIPTOR_MIN) {
    countHint.className = "count-bad";
    countHint.appendChild(txt(`(min ${DESCRIPTOR_MIN})`));
  } else if (count > DESCRIPTOR_MAX) {
    countHint.className = "count-warn";
    countHint.appendChild(txt(`(max ${DESCRIPTOR_MAX} — trim)`));
  } else {
    countHint.className = "count-ok";
    countHint.appendChild(txt("✓"));
  }
  countSpan.appendChild(countHint);
  meta.appendChild(countSpan);

  const charSpan = el("span");
  charSpan.appendChild(txt(`${charLen} chars `));
  const charHint = el("span");
  if (charLen > STYLE_SOFT_LIMIT) {
    charHint.className = "count-warn";
    charHint.appendChild(txt(`(soft limit ${STYLE_SOFT_LIMIT})`));
  } else {
    charHint.className = "count-ok";
    charHint.appendChild(txt("✓"));
  }
  charSpan.appendChild(charHint);
  meta.appendChild(charSpan);

  // Warnings
  warningsEl.textContent = "";
  const contradictions = checkContradictions(style);
  contradictions.forEach(([a, b]) => {
    const w = el("div", "warn red");
    const ic = el("span", "ic", "✗");
    const msg = el("span");
    msg.appendChild(txt(`Contradiction: "${a}" vs "${b}"`));
    w.appendChild(ic);
    w.appendChild(msg);
    warningsEl.appendChild(w);
  });

  const empties = checkEmptyWords(style);
  if (empties.length) {
    const w = el("div", "warn amber");
    const ic = el("span", "ic", "!");
    const msg = el("span");
    msg.appendChild(txt(`Empty words (no sonic info): ${empties.join(", ")}`));
    w.appendChild(ic);
    w.appendChild(msg);
    warningsEl.appendChild(w);
  }

  snapshotBuild();
}

function initLyricsTags() {
  const container = document.getElementById("build-tag-buttons");
  const textarea = document.getElementById("build-lyrics");

  // Structure tags wrap with newlines; voice/dynamics are inline.
  STRUCTURE_TAGS.forEach((tag) => {
    const chip = el("button", "chip tag-chip", `[${tag}]`);
    chip.type = "button";
    chip.addEventListener("click", () => insertTag(textarea, `\n[${tag}]\n`));
    container.appendChild(chip);
  });

  const vLabel = el("div", "group-label", "Voice");
  container.appendChild(vLabel);
  VOICE_TAGS.forEach((tag) => {
    const chip = el("button", "chip tag-chip", `[${tag}]`);
    chip.type = "button";
    chip.addEventListener("click", () => insertTag(textarea, `[${tag}]`));
    container.appendChild(chip);
  });

  const dLabel = el("div", "group-label", "Dynamics");
  container.appendChild(dLabel);
  DYNAMICS_TAGS.forEach((tag) => {
    const chip = el("button", "chip tag-chip", `[${tag}]`);
    chip.type = "button";
    chip.addEventListener("click", () => insertTag(textarea, `[${tag}]`));
    container.appendChild(chip);
  });
}

// Insert text at cursor position in a textarea — treats it as a text operation,
// never as HTML.
function insertTag(textarea, text) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = before + text + after;
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();
  snapshotBuild();
}

document
  .getElementById("build-copy-style")
  .addEventListener("click", async (e) => {
    await copyAndFlash(e.currentTarget, buildStyleString());
  });

document
  .getElementById("build-copy-lyrics")
  .addEventListener("click", async (e) => {
    const ta = document.getElementById("build-lyrics");
    await copyAndFlash(e.currentTarget, ta.value);
  });

// Direct typing in the lyrics box (not via a tag chip) also persists.
document
  .getElementById("build-lyrics")
  .addEventListener("input", snapshotBuild);

// Song name: persist on type, copy on demand.
document.getElementById("build-name").addEventListener("input", snapshotBuild);
document
  .getElementById("build-copy-name")
  .addEventListener("click", async (e) => {
    await copyAndFlash(
      e.currentTarget,
      document.getElementById("build-name").value,
    );
  });

document.getElementById("build-save").addEventListener("click", async () => {
  const style = buildStyleString();
  if (!style) return;
  try {
    await addPrompt({
      text: style,
      title: "",
      tags: [],
      sourceUrl: "",
      source: "built",
    });
    // Switch to library so user sees it.
    document.querySelector('[data-tab="library"]').click();
  } catch (err) {
    console.error("[Suno] Save failed:", err.message);
  }
});

// ---------------------------------------------------------------------------
// Generate tab
// ---------------------------------------------------------------------------

let genMode = "vibe";

document
  .getElementById("mode-vibe")
  .addEventListener("click", () => setMode("vibe"));
document
  .getElementById("mode-artist")
  .addEventListener("click", () => setMode("artist"));

function setMode(mode) {
  genMode = mode;
  document
    .getElementById("mode-vibe")
    .classList.toggle("active", mode === "vibe");
  document
    .getElementById("mode-artist")
    .classList.toggle("active", mode === "artist");
  document
    .getElementById("gen-artist-note")
    .classList.toggle("hidden", mode !== "artist");
  // Swap the input's label + placeholder so the mode visibly changes what the
  // field expects: a feeling/scene (Vibe) vs a named artist/sound (Artist).
  const input = document.getElementById("gen-input");
  const label = document.getElementById("gen-input-label");
  if (mode === "artist") {
    input.placeholder = "e.g. Lana Del Rey, but darker — a sound, not a name";
    if (label) label.textContent = "Name an artist or sound";
  } else {
    input.placeholder = "e.g. late night drive, melancholy…";
    if (label) label.textContent = "Describe a vibe or feeling";
  }
  genAutocomplete.hide(); // pool changed — drop stale suggestions
  uiState = { ...uiState, gen: { ...uiState.gen, mode } };
  persistUi();
}

// ---------------------------------------------------------------------------
// Vibe-tab autocomplete — fuzzy dropdown of artists (Artist mode) or vibe/genre
// words (Vibe mode). Local + offline; Artist mode still decomposes the name.
// Shared engine in autocomplete.js (the Album seed uses it too).
// ---------------------------------------------------------------------------

const SUGGEST_ARTISTS = [...new Set(ARTISTS)];
const SUGGEST_VIBES = [...new Set(VIBE_WORDS)];

// Persist the vibe/artist input as the user types so a reopen restores it.
document.getElementById("gen-input").addEventListener("input", (e) => {
  uiState = { ...uiState, gen: { ...uiState.gen, input: e.target.value } };
  persistUi();
});

const genAutocomplete = attachAutocomplete({
  input: document.getElementById("gen-input"),
  box: document.getElementById("gen-suggest"),
  getPool: () => (genMode === "artist" ? SUGGEST_ARTISTS : SUGGEST_VIBES),
  segmentize: () => genMode !== "artist",
  onChoose: (value) => {
    uiState = { ...uiState, gen: { ...uiState.gen, input: value } };
    persistUi();
  },
});

// Persist the "what it's about" subject the same way.
document.getElementById("gen-subject").addEventListener("input", (e) => {
  uiState = { ...uiState, gen: { ...uiState.gen, subject: e.target.value } };
  persistUi();
});

// Persist the instrumental checkbox the same way.
document.getElementById("gen-instrumental").addEventListener("change", (e) => {
  uiState = {
    ...uiState,
    gen: { ...uiState.gen, instrumental: e.target.checked },
  };
  persistUi();
});

document.getElementById("gen-submit").addEventListener("click", handleGenerate);

async function handleGenerate() {
  const input = document.getElementById("gen-input").value.trim();
  if (!input) {
    alert("Describe a vibe or artist first.");
    return;
  }
  const subject = document.getElementById("gen-subject").value.trim();
  const instrumental = document.getElementById("gen-instrumental").checked;

  const loading = document.getElementById("gen-loading");
  const results = document.getElementById("gen-results");
  loading.classList.remove("hidden");
  results.classList.add("hidden");
  results.textContent = "";

  let settings;
  try {
    settings = await getSettings();
  } catch {
    settings = { apiKey: "", model: DEFAULT_MODEL };
  }

  let result;
  try {
    result = await generatePrompt({
      mode: genMode,
      input,
      subject,
      apiKey: settings.apiKey,
      model: settings.model,
      instrumental,
    });
  } catch (err) {
    loading.classList.add("hidden");
    const errEl = el("div", "warn red");
    const ic = el("span", "ic", "✗");
    const msg = el("span");
    msg.appendChild(txt(err.message));
    errEl.appendChild(ic);
    errEl.appendChild(msg);
    results.appendChild(errEl);
    results.classList.remove("hidden");
    return;
  }

  loading.classList.add("hidden");
  renderGenerateResults(results, result);
  results.classList.remove("hidden");

  // Persist the last result so reopening the panel restores it (not just the input).
  uiState = {
    ...uiState,
    gen: {
      ...uiState.gen,
      input,
      subject,
      instrumental,
      mode: genMode,
      result,
    },
  };
  persistUi();

  // Log to generation history. Never let a history-write failure break the
  // generate flow the user is actively watching.
  try {
    await addGeneration({
      mode: genMode,
      input,
      subject,
      instrumental,
      result,
    });
    renderGenHistory();
  } catch (err) {
    console.error("[Suno] Log generation failed:", err.message);
  }
}

function renderGenerateResults(container, result) {
  container.textContent = "";

  // If offline fallback, surface the notes prominently at top.
  if (result.fallback && result.notes) {
    const note = el("div", "fallback-note");
    note.appendChild(txt(result.notes));
    container.appendChild(note);
  }

  // Which style option (main or a variant) is currently selected — shared
  // between the Style picker and the paste button below.
  const styleOptions = buildStyleOptions(result);
  const styleSel = { idx: 0 };

  // One-click paste of the whole song (title + style + exclude + lyrics + slider
  // recommendations) into an open Suno tab. Status renders just beneath it.
  const pasteStatus = el("div", "settings-status");
  const pasteRow = el("div", "btn-row");
  const pasteBtn = el("button", "btn primary", "🎵 Paste all → Suno");
  pasteBtn.addEventListener("click", () =>
    pasteVibeIntoSuno(
      { ...result, style: styleOptions[styleSel.idx]?.text ?? result.style },
      pasteStatus,
    ),
  );
  pasteRow.appendChild(pasteBtn);
  container.appendChild(pasteRow);
  container.appendChild(pasteStatus);

  // Title leads — it's Suno's first field. Copy only (not a saveable prompt).
  if (result.title) {
    container.appendChild(
      buildResultSection("Title", result.title, "result-text"),
    );
  }
  if (styleOptions.length) {
    container.appendChild(
      buildStylePicker(styleOptions, styleSel, result, container),
    );
  }
  if (result.exclude) {
    container.appendChild(
      buildResultSection("Exclude", result.exclude, "result-text"),
    );
  }
  if (result.bpm) {
    container.appendChild(
      buildResultSection("BPM", result.bpm, "result-text bpm-text"),
    );
  }
  // Suno slider + vocal recommendations, compact.
  const settingsEl = renderSunoSettings(result);
  if (settingsEl) container.appendChild(settingsEl);
  // Real lyrics (subject given) replace the bare scaffold; otherwise show the
  // structure scaffold so the Lyrics field still has something to paste.
  if (result.lyrics) {
    container.appendChild(
      buildResultSection("Lyrics", result.lyrics, "result-text structure-text"),
    );
  } else if (result.structure) {
    container.appendChild(
      buildResultSection(
        "Structure scaffold",
        result.structure,
        "result-text structure-text",
        true,
      ),
    );
  }
  if (result.notes && !result.fallback) {
    container.appendChild(
      buildResultSection("Tip", result.notes, "result-text notes-text"),
    );
  }
}

// Renders the Style section for a generate result. With 2+ options (main +
// variants) it shows a toggle above the style text; picking a toggle updates
// the shown text and what Copy / Save operate on. With exactly one option it
// renders identically to a plain buildResultSection("Style", ...) call — no
// visual change for results with no variants.
function buildStylePicker(styleOptions, styleSel, result, container) {
  const section = el("div", "result-section");
  section.appendChild(el("div", "result-label", "Style"));

  const textEl = el("div", "result-text");
  textEl.appendChild(txt(styleOptions[styleSel.idx].text));

  if (styleOptions.length > 1) {
    section.appendChild(buildStyleToggle(styleOptions, styleSel, textEl));
  }
  section.appendChild(textEl);

  section.appendChild(
    buildRiffControls(result, styleOptions, styleSel, container),
  );

  const row = el("div", "btn-row");
  const copyBtn = el("button", "btn", "Copy");
  copyBtn.addEventListener("click", () =>
    copyAndFlash(copyBtn, styleOptions[styleSel.idx].text),
  );
  row.appendChild(copyBtn);

  const saveBtn = el("button", "btn", "Save to Library");
  saveBtn.addEventListener("click", async () => {
    try {
      await addPrompt({
        text: styleOptions[styleSel.idx].text,
        title: "",
        tags: [],
        sourceUrl: "",
        source: "generated",
      });
      saveBtn.textContent = "Saved!";
      setTimeout(() => {
        saveBtn.textContent = "Save to Library";
      }, 1400);
    } catch (err) {
      console.error("[Suno] Save failed:", err.message);
    }
  });
  row.appendChild(saveBtn);

  section.appendChild(row);
  return section;
}

// Segmented toggle (mirrors the .mode-toggle / .mode-btn pattern) for picking
// which style option is active. Clicking updates styleSel.idx, restyles
// .active, and re-renders textEl's content via textContent + txt() — never
// innerHTML.
function buildStyleToggle(styleOptions, styleSel, textEl) {
  const toggle = el("div", "mode-toggle style-toggle");
  const buttons = styleOptions.map((opt, i) => {
    const btn = el("button", "mode-btn", opt.label);
    if (i === styleSel.idx) btn.classList.add("active");
    btn.addEventListener("click", () => {
      styleSel.idx = i;
      buttons.forEach((b, j) => b.classList.toggle("active", j === i));
      textEl.textContent = "";
      textEl.appendChild(txt(styleOptions[i].text));
    });
    toggle.appendChild(btn);
    return btn;
  });
  return toggle;
}

// "Riff the sound" — quick nudge chips + a free-text tweak. Regenerates ONLY
// the sound fields (style/variants/exclude/bpm/sliders) via riffStyle(),
// keeping the words + song identity locked. Never logged to generation
// history — this is in-place tinkering, not a new generation.
const RIFF_NUDGES = [
  "Darker",
  "Brighter",
  "Heavier",
  "Softer",
  "More cinematic",
  "Weirder",
  "Cleaner",
  "Slower",
];

function buildRiffControls(result, styleOptions, styleSel, container) {
  const wrap = el("div", "riff-row");
  wrap.appendChild(el("div", "result-label riff-label", "Riff the sound"));

  const status = el("div", "settings-status riff-status hidden");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "riff-input";
  input.placeholder = "tweak… e.g. more dark, less synth";
  const riffBtn = el("button", "btn nudge", "Riff");

  const runNudge = (nudge) => {
    const tweak = String(nudge || "").trim();
    if (!tweak) return;
    handleRiff({
      result,
      styleOptions,
      styleSel,
      container,
      nudge: tweak,
      riffBtn,
      status,
    });
  };

  const chipsRow = el("div", "chips riff-chips");
  RIFF_NUDGES.forEach((nudge) => {
    const chip = el("button", "chip", nudge);
    chip.addEventListener("click", () => runNudge(nudge));
    chipsRow.appendChild(chip);
  });
  wrap.appendChild(chipsRow);

  const inputRow = el("div", "riff-input-row");
  inputRow.appendChild(input);
  riffBtn.addEventListener("click", () => runNudge(input.value));
  inputRow.appendChild(riffBtn);
  wrap.appendChild(inputRow);

  wrap.appendChild(status);
  return wrap;
}

// Calls riffStyle() with the currently-selected style, merges the result over
// the existing generate result (lyrics/title/structure/vocalGender locked),
// and re-renders the whole results container in place.
async function handleRiff({
  result,
  styleOptions,
  styleSel,
  container,
  nudge,
  riffBtn,
  status,
}) {
  const currentStyle = styleOptions[styleSel.idx]?.text ?? result.style;
  const origLabel = riffBtn.textContent;
  riffBtn.disabled = true;
  riffBtn.textContent = "Riffing…";
  status.textContent = "";
  status.classList.add("hidden");

  let settings;
  try {
    settings = await getSettings();
  } catch {
    settings = { apiKey: "", model: DEFAULT_MODEL };
  }

  try {
    const riff = await riffStyle({
      currentStyle,
      nudge,
      apiKey: settings.apiKey,
      model: settings.model,
    });
    const merged = mergeRiff(result, riff);
    renderGenerateResults(container, merged);
    uiState = { ...uiState, gen: { ...uiState.gen, result: merged } };
    persistUi();
  } catch (err) {
    console.error("[Suno] Riff failed:", err.message);
    riffBtn.disabled = false;
    riffBtn.textContent = origLabel;
    const warnEl = el("div", "warn red");
    warnEl.appendChild(el("span", "ic", "✗"));
    const msg = el("span");
    msg.appendChild(txt(err.message));
    warnEl.appendChild(msg);
    status.textContent = "";
    status.appendChild(warnEl);
    status.classList.remove("hidden");
  }
}

// Builds one result card. savable=true shows "Save to library"; variantSave
// saves variant text (not the main style).
function buildResultSection(
  label,
  content,
  textClass,
  savable,
  mainResult,
  isVariant,
) {
  const section = el("div", "result-section");
  const labelEl = el("div", "result-label", label);
  section.appendChild(labelEl);

  const textEl = el("div", textClass);
  textEl.appendChild(txt(content));
  section.appendChild(textEl);

  const row = el("div", "btn-row");

  const copyBtn = el("button", "btn", "Copy");
  copyBtn.addEventListener("click", () => copyAndFlash(copyBtn, content));
  row.appendChild(copyBtn);

  if (savable) {
    const saveBtn = el("button", "btn", "Save to Library");
    saveBtn.addEventListener("click", async () => {
      try {
        const saveText = isVariant ? content : mainResult?.style || content;
        await addPrompt({
          text: saveText,
          title: "",
          tags: [],
          sourceUrl: "",
          source: "generated",
        });
        saveBtn.textContent = "Saved!";
        setTimeout(() => {
          saveBtn.textContent = "Save to Library";
        }, 1400);
      } catch (err) {
        console.error("[Suno] Save failed:", err.message);
      }
    });
    row.appendChild(saveBtn);
  }

  section.appendChild(row);
  return section;
}

// Compact block for Suno's non-text recommendations: vocal gender + the two
// sliders (Weirdness, Style Influence). Returns null when there's nothing to show.
function renderSunoSettings(result) {
  const bits = [];
  if (result.vocalGender)
    bits.push([
      "Vocals",
      result.vocalGender === "any" ? "any / either" : result.vocalGender,
    ]);
  if (result.weirdness !== "" && result.weirdness != null)
    bits.push(["Weirdness", `${result.weirdness}%`]);
  if (result.styleInfluence !== "" && result.styleInfluence != null)
    bits.push(["Style influence", `${result.styleInfluence}%`]);
  if (!bits.length) return null;

  const section = el("div", "result-section");
  section.appendChild(el("div", "result-label", "Suno settings"));
  const box = el("div", "suno-settings");
  for (const [k, v] of bits) {
    const row = el("div", "suno-setting");
    row.appendChild(el("span", "suno-setting-k", k));
    row.appendChild(el("span", "suno-setting-v", v));
    box.appendChild(row);
  }
  section.appendChild(box);
  section.appendChild(
    el(
      "div",
      "hint",
      "“Paste all → Suno” sets these where it can; otherwise nudge the sliders to match.",
    ),
  );
  return section;
}

// Fill an open Suno tab's fields from a Vibe result — title + style + exclude +
// lyrics, plus best-effort slider values. Mirrors the Set tab's paste: find the
// suno.com tab, message the content script, inject + retry once on a stale tab.
async function pasteVibeIntoSuno(result, statusEl) {
  const setStatus = (t) => {
    if (statusEl) statusEl.textContent = t;
  };
  let tabs;
  try {
    tabs = await chrome.tabs.query({ url: "https://suno.com/*" });
  } catch {
    setStatus("Couldn't reach Chrome tabs.");
    return;
  }
  if (!tabs.length) {
    setStatus("Open a suno.com tab first (log in → Create page).");
    return;
  }
  const tabId = tabs[0].id;
  const payload = {
    type: "suno-fill",
    title: result.title || "",
    style: result.style || "",
    exclude: result.exclude || "",
    lyrics: result.lyrics || result.structure || "",
    weirdness: result.weirdness || "",
    styleInfluence: result.styleInfluence || "",
  };
  let resp;
  try {
    resp = await chrome.tabs.sendMessage(tabId, payload);
  } catch (firstErr) {
    // No live content script in that tab (pre-existing tab, or stale after an
    // extension reload). Inject it, then retry. Surface the real error on both
    // steps so a failure is diagnosable instead of a generic dead-end.
    console.warn(
      "[Suno] paste: sendMessage failed, re-injecting —",
      firstErr?.message,
    );
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["suno-fill.js"],
      });
      resp = await chrome.tabs.sendMessage(tabId, payload);
    } catch (injectErr) {
      console.error(
        "[Suno] paste: re-inject/retry failed —",
        injectErr?.message,
      );
      setStatus(
        `Couldn't reach the Suno tab — reload suno.com and retry. (${injectErr?.message || "unknown"})`,
      );
      return;
    }
  }
  if (resp && resp.ok) {
    chrome.tabs.update(tabId, { active: true });
    const values = {
      weirdness: result.weirdness,
      styleInfluence: result.styleInfluence,
    };
    const sliderResult = await driveSunoSliders(tabId, values);
    setStatus(sliderPasteMessage(sliderResult, values));
  } else {
    setStatus((resp && resp.error) || "Couldn't fill Suno's fields.");
  }
}

// ---------------------------------------------------------------------------
// Saved vibes — reusable seeds (reference + subject + mode). Save from the Vibe
// tab; reload back into it. The Set tab loads these too (see set-tab.js).
// ---------------------------------------------------------------------------

async function renderSavedVibes() {
  const list = document.getElementById("vibe-saved-list");
  const summary = document.querySelector("#vibe-saved summary");
  let vibes = [];
  try {
    vibes = await getAllVibes();
  } catch (err) {
    console.warn("[Suno] Load vibes failed:", err.message);
  }
  if (summary) summary.textContent = `📎 Saved vibes (${vibes.length})`;
  list.textContent = "";
  if (!vibes.length) {
    list.appendChild(
      el("p", "hint", "No saved vibes yet — fill one in and tap “Save vibe.”"),
    );
    return;
  }
  vibes.forEach((v) => list.appendChild(buildVibeRow(v)));
}

function buildVibeRow(v) {
  const row = el("div", "myset-row");
  const info = el("div", "myset-info");
  info.appendChild(
    el("strong", "", v.name || v.reference.slice(0, 40) || "Untitled vibe"),
  );
  const meta = [
    v.mode === "artist" ? "Artist" : "Vibe",
    v.subject ? "· has lyrics subject" : "",
  ]
    .filter(Boolean)
    .join(" ");
  info.appendChild(el("span", "hint", meta));
  row.appendChild(info);

  const load = el("button", "btn", "Load");
  load.addEventListener("click", () => loadVibe(v));
  row.appendChild(load);

  const del = el("button", "btn", "🗑");
  del.title = "Delete";
  del.addEventListener("click", async () => {
    if (!confirm(`Delete saved vibe "${v.name || "Untitled"}"?`)) return;
    try {
      await deleteVibe(v.id);
      renderSavedVibes();
    } catch (err) {
      console.warn("[Suno] Delete vibe failed:", err.message);
    }
  });
  row.appendChild(del);
  return row;
}

function loadVibe(v) {
  const mode = v.mode === "artist" ? "artist" : "vibe";
  document.getElementById("gen-input").value = v.reference || "";
  document.getElementById("gen-subject").value = v.subject || "";
  setMode(mode);
  uiState = {
    ...uiState,
    gen: {
      ...uiState.gen,
      input: v.reference || "",
      subject: v.subject || "",
      mode,
    },
  };
  persistUi();
  document.getElementById("gen-input").focus();
}

document.getElementById("gen-save-vibe").addEventListener("click", async () => {
  const reference = document.getElementById("gen-input").value.trim();
  const subject = document.getElementById("gen-subject").value.trim();
  const status = document.getElementById("gen-save-status");
  if (!reference) {
    status.textContent = "Add a vibe or artist first.";
    setTimeout(() => (status.textContent = ""), 2000);
    return;
  }
  // Name it from the last generated title if there is one, else the reference.
  const title = uiState.gen && uiState.gen.result && uiState.gen.result.title;
  const name = String(title || reference).slice(0, 50);
  try {
    await addVibe({ name, reference, subject, mode: genMode });
    status.textContent = "Saved vibe ✓";
    renderSavedVibes();
    setTimeout(() => (status.textContent = ""), 2000);
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  }
});

// ---------------------------------------------------------------------------
// Generation history — a log of every completed Generate-tab run (input +
// full output). Lets the user browse past generations and re-paste or reload
// any of them. Written from handleGenerate(); rendered here.
// ---------------------------------------------------------------------------

async function renderGenHistory() {
  const list = document.getElementById("gen-history-list");
  const summary = document.querySelector("#gen-history summary");
  let entries = [];
  try {
    entries = await getAllGenerations();
  } catch (err) {
    console.warn("[Suno] Load generation history failed:", err.message);
  }
  if (summary)
    summary.textContent = `🕘 Recent generations (${entries.length})`;
  list.textContent = "";
  if (!entries.length) {
    list.appendChild(el("p", "hint", "No generations yet — hit “Generate.”"));
    return;
  }
  entries.forEach((entry) => list.appendChild(buildGenHistoryRow(entry)));
}

function buildGenHistoryRow(entry) {
  const row = el("div", "myset-row");
  const info = el("div", "myset-info");
  const result = entry.result || {};
  info.appendChild(
    el("strong", "", result.title || entry.input.slice(0, 40) || "Untitled"),
  );
  const styleSnippet = String(result.style || "").slice(0, 60);
  const meta = [
    relativeAge(entry.createdAt),
    styleSnippet,
    entry.instrumental ? "🎹 instrumental" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  info.appendChild(el("span", "hint", meta));
  row.appendChild(info);

  const status = el("div", "settings-status");

  // Star toggle — starred entries are exempt from the 500-record cap.
  const star = el("button", "btn", entry.starred ? "★" : "☆");
  star.title = entry.starred
    ? "Starred (kept forever) — click to unstar"
    : "Star to keep past the 500 cap";
  star.addEventListener("click", async () => {
    try {
      await toggleStar(entry.id);
      renderGenHistory();
    } catch (err) {
      console.warn("[Suno] Star generation failed:", err.message);
    }
  });
  row.appendChild(star);

  const paste = el("button", "btn primary", "Paste → Suno");
  paste.addEventListener("click", () => pasteVibeIntoSuno(result, status));
  row.appendChild(paste);

  const load = el("button", "btn", "Load");
  load.addEventListener("click", () => loadGeneration(entry));
  row.appendChild(load);

  const del = el("button", "btn", "🗑");
  del.title = "Delete";
  del.addEventListener("click", async () => {
    try {
      await deleteGeneration(entry.id);
      renderGenHistory();
    } catch (err) {
      console.warn("[Suno] Delete generation failed:", err.message);
    }
  });
  row.appendChild(del);
  row.appendChild(status);
  return row;
}

function loadGeneration(entry) {
  document.getElementById("gen-input").value = entry.input || "";
  document.getElementById("gen-subject").value = entry.subject || "";
  document.getElementById("gen-instrumental").checked = Boolean(
    entry.instrumental,
  );
  setMode(entry.mode);
  const results = document.getElementById("gen-results");
  renderGenerateResults(results, entry.result);
  results.classList.remove("hidden");
}

document
  .getElementById("gen-history-clear")
  .addEventListener("click", async () => {
    if (!confirm("Clear unstarred generations? Starred entries are kept."))
      return;
    try {
      await clearGenerations();
      renderGenHistory();
    } catch (err) {
      console.warn("[Suno] Clear generation history failed:", err.message);
    }
  });

// ---------------------------------------------------------------------------
// Settings tab
// ---------------------------------------------------------------------------

async function initSettings() {
  const modelSelect = document.getElementById("settings-model");
  MODELS.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  });

  try {
    const settings = await getSettings();
    document.getElementById("settings-apikey").value = settings.apiKey;
    modelSelect.value = settings.model;
  } catch (err) {
    console.error("[Suno] Settings load failed:", err.message);
  }
}

document.getElementById("settings-save").addEventListener("click", async () => {
  const apiKey = document.getElementById("settings-apikey").value;
  const model = document.getElementById("settings-model").value;
  const status = document.getElementById("settings-status");

  try {
    // setSettings never logs the key.
    await setSettings({ apiKey, model });
    status.textContent = "Saved.";
    // A saved key retires the first-run nudge immediately (no reload needed).
    if (apiKey.trim())
      document.getElementById("first-run-banner")?.classList.add("hidden");
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
    console.error("[Suno] Settings save failed:", err.message);
  }
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

// First-run nudge: if no API key is set, show the onboarding banner (Anthropic
// key + Suno credits). Dismiss is session-only; once a key is saved it never
// shows again. Wiring is idempotent-safe (called once from boot).
async function initFirstRunBanner() {
  const banner = document.getElementById("first-run-banner");
  if (!banner) return;
  let hasKey = false;
  try {
    hasKey = !!(await getSettings()).apiKey;
  } catch {
    hasKey = false;
  }
  if (hasKey) return; // key present → never nag
  banner.classList.remove("hidden");
  document.getElementById("first-run-key")?.addEventListener("click", () => {
    document.querySelector('.tab-btn[data-tab="settings"]')?.click();
    document.getElementById("settings-apikey")?.focus();
    const help = document.getElementById("settings-help");
    if (help) help.open = true;
  });
  document
    .getElementById("first-run-dismiss")
    ?.addEventListener("click", () => banner.classList.add("hidden"));
}

// Restore the Build tab's saved chip/select state from uiState.build.
function restoreBuild() {
  const b = uiState.build;
  if (!b || typeof b !== "object") return;

  const genreSelect = document.getElementById("build-genre");
  if (b.genre) {
    const known = [...genreSelect.options].some((o) => o.value === b.genre);
    if (known) {
      genreSelect.value = b.genre;
      buildState.genre = b.genre;
    } else {
      // Not a listed genre → restore through the Custom-genre path.
      const family = document.getElementById("build-family");
      const custom = document.getElementById("build-genre-custom");
      if (family && custom) {
        custom.value = b.genre;
        family.value = "__custom__";
        family.dispatchEvent(new Event("change"));
      }
      buildState.genre = b.genre;
    }
  }

  const eraSelect = document.getElementById("build-era");
  if (b.era && [...eraSelect.options].some((o) => o.value === b.era)) {
    eraSelect.value = b.era;
    buildState.era = b.era;
  }

  const applySet = (containerId, arr, stateSet) => {
    stateSet.clear();
    for (const v of arr || []) stateSet.add(v);
    const container = document.getElementById(containerId);
    for (const chip of container.querySelectorAll(".chip"))
      chip.classList.toggle("on", stateSet.has(chip.textContent));
  };
  applySet("build-mood-chips", b.moods, buildState.moods);
  applySet("build-instrument-chips", b.instruments, buildState.instruments);
  applySet("build-vocal-chips", b.vocals, buildState.vocals);

  const lyrics = document.getElementById("build-lyrics");
  if (lyrics && typeof b.lyrics === "string") lyrics.value = b.lyrics;

  const nameEl = document.getElementById("build-name");
  if (nameEl && typeof b.name === "string") nameEl.value = b.name;

  updateBuildPreview();
}

// Restore the Vibe tab's input, mode, and last result.
function restoreGen() {
  const g = uiState.gen;
  if (!g || typeof g !== "object") return;
  if (typeof g.input === "string")
    document.getElementById("gen-input").value = g.input;
  if (typeof g.subject === "string")
    document.getElementById("gen-subject").value = g.subject;
  if (typeof g.instrumental === "boolean")
    document.getElementById("gen-instrumental").checked = g.instrumental;
  if (g.mode === "vibe" || g.mode === "artist") setMode(g.mode);
  if (g.result && typeof g.result === "object") {
    const results = document.getElementById("gen-results");
    renderGenerateResults(results, g.result);
    results.classList.remove("hidden");
  }
}

const VALID_TABS = [
  "generate",
  "build",
  "set",
  "album",
  "wav",
  "library",
  "settings",
];

(async function boot() {
  try {
    // Load saved session state first so restores below have it (init calls that
    // fire during setup can't persist — the `booted` gate keeps persistUi off).
    try {
      uiState = await getUiState();
    } catch {
      uiState = {};
    }

    initBuildSelects();
    initBuildChips();
    updateBuildPreview();
    initLyricsTags();
    // Async storage reads — cover them with the loading overlay.
    await Promise.allSettled([
      initSettings(),
      renderLibrary(),
      renderSavedVibes(),
      renderGenHistory(),
      initFirstRunBanner(),
    ]);

    // Replay saved session state, then open persistence for real.
    restoreBuild();
    restoreGen();
    if (VALID_TABS.includes(uiState.activeTab))
      activateTab(uiState.activeTab, false);
    booted = true;
  } finally {
    // Always clear the overlay, even if a storage read failed.
    document.getElementById("app-loading")?.classList.add("loaded");
  }
})();
