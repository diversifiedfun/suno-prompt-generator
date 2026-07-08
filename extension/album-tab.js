// album-tab.js — the Album tab controller. Seed a cohesive record or concept
// album from a vibe/artist (or a saved vibe / library song), plan the tracklist,
// then generate + copy/paste each track. Mirrors set-tab's staged flow but with
// no energy arc. Stages: A (seed), B (tracklist), C (generated tracks).
import { el, copyAndFlash } from "./dom-utils.js";
import {
  createAlbum,
  getAllAlbums,
  getAlbum,
  updateAlbum,
  deleteAlbum,
} from "./album-storage.js";
import {
  planAlbum,
  generateAlbumTrack,
  clampCount,
} from "./album-generator.js";
import { getSettings, getAllVibes, getAllPrompts } from "./storage.js";
import { driveSunoSliders, sliderPasteMessage } from "./suno-slider-driver.js";
import { attachAutocomplete } from "./autocomplete.js";
import { ARTISTS, VIBE_WORDS } from "./suggest-data.js";

const $a = (id) => document.getElementById(id);
const A_ARTISTS = [...new Set(ARTISTS)];
const A_VIBES = [...new Set(VIBE_WORDS)];

let currentAlbumId = null;
const state = { seedMode: "vibe", albumType: "cohesive" };
// Autocomplete handle (set once the tab inits) so the mode toggle can close it.
let seedAc = { hide() {} };
// Serializes generation so two overlapping regenerate/generate-all clicks can't
// race read-modify-write on the tracks array and lose each other's updates.
let busy = false;

export function renderAlbumTab() {
  if ($a("album-stage-a").dataset.init) {
    renderMyAlbums();
    renderSeedSources();
    return;
  }
  $a("album-stage-a").dataset.init = "1";

  wireToggle("album-mode-vibe", "album-mode-artist", "amode", (v) => {
    state.seedMode = v;
    $a("album-artist-note").classList.toggle("hidden", v !== "artist");
    seedAc.hide();
  });
  wireToggle("album-type-cohesive", "album-type-concept", "atype", (v) => {
    state.albumType = v;
  });

  seedAc = attachAutocomplete({
    input: $a("album-seed"),
    box: $a("album-seed-suggest"),
    getPool: () => (state.seedMode === "artist" ? A_ARTISTS : A_VIBES),
    segmentize: () => state.seedMode !== "artist",
  });

  $a("album-plan").addEventListener("click", onPlanAlbum);
  initAlbumWizard();
  renderMyAlbums();
  renderSeedSources();
}

// Two mutually-exclusive .mode-btn buttons sharing a data-attr; onPick(value).
function wireToggle(idA, idB, attr, onPick) {
  const btns = [$a(idA), $a(idB)];
  for (const b of btns)
    b.addEventListener("click", () => {
      for (const x of btns) x.classList.toggle("active", x === b);
      onPick(b.dataset[attr]);
    });
}

// Saved vibes + library songs as chips that fill the seed box.
async function renderSeedSources() {
  const box = $a("album-seed-saved");
  box.textContent = "";
  let vibes = [];
  let prompts = [];
  try {
    [vibes, prompts] = await Promise.all([getAllVibes(), getAllPrompts()]);
  } catch (err) {
    console.warn("Album seed sources failed:", err);
  }
  for (const v of vibes.slice(0, 8)) {
    const label = v.name || v.reference.slice(0, 24) || "vibe";
    addSeedChip(box, `📎 ${label}`, v.reference || "", v.mode === "artist");
  }
  for (const p of prompts.slice(0, 8)) {
    const label = p.title || p.text.slice(0, 24);
    addSeedChip(box, `🎵 ${label}`, p.text || "", false);
  }
}

function addSeedChip(box, label, value, isArtist) {
  const chip = el("button", "chip", label);
  chip.type = "button";
  chip.title = "Seed the album with this";
  chip.addEventListener("click", () => {
    $a("album-seed").value = value;
    if (isArtist) $a("album-mode-artist").click();
  });
  box.appendChild(chip);
}

async function renderMyAlbums() {
  const list = $a("album-mine-list");
  const summary = $a("album-mine").querySelector("summary");
  const albums = await getAllAlbums();
  summary.textContent = `📁 My albums (${albums.length})`;
  list.textContent = "";
  if (!albums.length) {
    list.appendChild(el("p", "hint", "No albums yet."));
    return;
  }
  for (const alb of albums) {
    const row = el("div", "myset-row");
    const info = el("div", "myset-info");
    info.appendChild(el("strong", "", alb.title || "Untitled album"));
    info.appendChild(
      el("span", "hint", `${alb.tracks.length} tracks · ${alb.mode}`),
    );
    row.appendChild(info);
    const open = el("button", "btn", "Open");
    open.addEventListener("click", () => openAlbum(alb.id));
    row.appendChild(open);
    const del = el("button", "btn", "🗑");
    del.title = "Delete";
    del.addEventListener("click", async () => {
      if (!confirm(`Delete "${alb.title || "Untitled album"}"?`)) return;
      await deleteAlbum(alb.id);
      renderMyAlbums();
    });
    row.appendChild(del);
    list.appendChild(row);
  }
}

async function openAlbum(id) {
  const alb = await getAlbum(id);
  if (!alb) return;
  currentAlbumId = alb.id;
  const hasGenerated = alb.tracks.some((t) => t.status === "generated");
  if (hasGenerated) {
    showStage("c");
    renderAlbumTracks(alb);
  } else if (alb.tracks.length) {
    showStage("b");
    renderAlbumPlan(alb);
  } else {
    showStage("a");
  }
}

// --- Guided wizard (stage A): reveal one intake step at a time. Inputs stay in
// the DOM the whole time, so every $a()/onPlanAlbum read is untouched. The seed
// (step 0) is the single required choice. ---
const ALBUM_WIZ_STEPS = 3;
let albumWizStep = 0;

function gotoAlbumWizStep(i) {
  const dots = $a("album-wiz-dots");
  if (!dots) return; // wizard markup absent (defensive)
  albumWizStep = Math.max(0, Math.min(ALBUM_WIZ_STEPS - 1, i));
  for (const s of document.querySelectorAll("#album-wiz .wiz-step"))
    s.hidden = Number(s.dataset.step) !== albumWizStep;
  const kids = dots.children;
  for (let d = 0; d < kids.length; d++) {
    kids[d].classList.toggle("on", d === albumWizStep);
    kids[d].classList.toggle("done", d < albumWizStep);
  }
  $a("album-wiz-back").style.visibility =
    albumWizStep === 0 ? "hidden" : "visible";
  $a("album-wiz-next").hidden = albumWizStep === ALBUM_WIZ_STEPS - 1;
  $a("album-wiz-count").textContent =
    `Step ${albumWizStep + 1} of ${ALBUM_WIZ_STEPS}`;
}

function initAlbumWizard() {
  const dots = $a("album-wiz-dots");
  if (!dots || dots.dataset.init) return;
  dots.dataset.init = "1";
  for (let i = 0; i < ALBUM_WIZ_STEPS; i++) {
    const dot = document.createElement("span");
    dot.className = "wiz-dot";
    dots.appendChild(dot);
  }
  $a("album-wiz-back").addEventListener("click", () =>
    gotoAlbumWizStep(albumWizStep - 1),
  );
  $a("album-wiz-next").addEventListener("click", () => {
    if (albumWizStep === 0 && !$a("album-seed").value.trim()) {
      $a("album-status").textContent =
        "Add a vibe or artist to seed the album.";
      return;
    }
    $a("album-status").textContent = "";
    gotoAlbumWizStep(albumWizStep + 1);
  });
  gotoAlbumWizStep(0);
}

function showStage(which) {
  $a("album-stage-a").classList.toggle("hidden", which !== "a");
  $a("album-stage-b").classList.toggle("hidden", which !== "b");
  $a("album-stage-c").classList.toggle("hidden", which !== "c");
  if (which === "a") gotoAlbumWizStep(0); // reopened intake starts at step 1
}

async function onPlanAlbum() {
  const seed = $a("album-seed").value.trim();
  if (!seed) {
    $a("album-status").textContent = "Add a vibe or artist to seed the album.";
    return;
  }
  const trackCount = clampCount(Number($a("album-count").value));
  const album = await createAlbum({
    seed,
    seedMode: state.seedMode,
    mode: state.albumType,
    trackCount,
    // Don't persist a raw artist seed as the title even transiently (before the
    // plan's title overwrites it) — Suno policy. Vibe seeds are safe.
    title: state.seedMode === "artist" ? "New album" : seed.slice(0, 40),
  });
  currentAlbumId = album.id;
  $a("album-status").textContent = "Designing the album…";
  const { apiKey, model } = await getSettings();
  const plan = await planAlbum({
    seed,
    seedMode: state.seedMode,
    mode: state.albumType,
    trackCount,
    apiKey,
    model,
  });
  await updateAlbum(album.id, {
    title: plan.albumTitle || album.title,
    soundDNA: plan.soundDNA,
    exclude: plan.exclude,
    tracks: plan.tracks.map((brief) => ({ brief, status: "planned" })),
    offline: plan.offline || false,
    offlineNote: plan.offlineNote || "",
  });
  $a("album-status").textContent = "";
  showStage("b");
  renderAlbumPlan(await getAlbum(album.id));
  renderMyAlbums();
}

// Editable title bar (albums auto-persist — this is rename-in-place).
function albumTitleBar(alb) {
  const bar = el("div", "myset-titlebar");
  const input = document.createElement("input");
  input.type = "text";
  input.className = "myset-title-input";
  input.value = alb.title || "";
  input.addEventListener("change", async () => {
    await updateAlbum(currentAlbumId, { title: input.value });
    renderMyAlbums();
  });
  bar.append(input, el("span", "hint", "Saved ✓"));
  return bar;
}

// Stage B — the album's shared sound + the tracklist of briefs.
function renderAlbumPlan(alb) {
  const b = $a("album-stage-b");
  b.textContent = "";
  b.appendChild(albumTitleBar(alb));

  if (alb.offline && alb.offlineNote) {
    const note = el("div", "warn amber conv-line");
    note.textContent = "⚠ " + alb.offlineNote;
    b.appendChild(note);
  }

  const dna = el("div", "result-section");
  dna.appendChild(el("div", "result-label", "The album's sound"));
  dna.appendChild(el("div", "result-text", alb.soundDNA || "(none yet)"));
  if (alb.exclude)
    dna.appendChild(el("div", "hint", `Exclude: ${alb.exclude}`));
  b.appendChild(dna);

  alb.tracks.forEach((t, i) => {
    const card = el("div", "brief-card");
    card.appendChild(
      el("strong", "", `#${i + 1} · ${t.brief.role} · ${t.brief.trackTitle}`),
    );
    if (t.brief.angle) card.appendChild(el("div", "hint", t.brief.angle));
    b.appendChild(card);
  });

  const replan = el("button", "btn", "Re-plan");
  replan.addEventListener("click", onPlanAlbumReplan);
  const gen = el("button", "btn primary", "Generate all tracks");
  gen.addEventListener("click", async () =>
    startGenerateAll(await getAlbum(currentAlbumId)),
  );
  const row = el("div", "btn-row");
  row.append(replan, gen);
  b.appendChild(row);
}

// Re-plan reuses the stored seed/mode/count for a fresh outline.
async function onPlanAlbumReplan() {
  const alb = await getAlbum(currentAlbumId);
  $a("album-status").textContent = "Re-planning…";
  const { apiKey, model } = await getSettings();
  const plan = await planAlbum({
    seed: alb.seed,
    seedMode: alb.seedMode,
    mode: alb.mode,
    trackCount: alb.trackCount,
    apiKey,
    model,
  });
  await updateAlbum(currentAlbumId, {
    title: plan.albumTitle || alb.title,
    soundDNA: plan.soundDNA,
    exclude: plan.exclude,
    tracks: plan.tracks.map((brief) => ({ brief, status: "planned" })),
    offline: plan.offline || false,
    offlineNote: plan.offlineNote || "",
  });
  $a("album-status").textContent = "";
  renderAlbumPlan(await getAlbum(currentAlbumId));
}

async function startGenerateAll(alb) {
  if (busy) return; // one generation loop at a time (no concurrent writes)
  busy = true;
  showStage("c");
  const c = $a("album-stage-c");
  c.textContent = "";
  const status = el("p", "settings-status");
  c.appendChild(status);
  // Every await runs inside try/finally so `busy` always resets — getSettings()
  // rejecting must not permanently lock generation. (The synchronous DOM setup
  // above touches only static ids and doesn't throw.)
  try {
    const { apiKey, model } = await getSettings();
    const done = [];
    for (let i = 0; i < alb.tracks.length; i++) {
      status.textContent = `Generating track ${i + 1} of ${alb.tracks.length}…`;
      const track = await generateAlbumTrack({
        album: alb,
        brief: alb.tracks[i].brief,
        apiKey,
        model,
      });
      done.push({ ...alb.tracks[i], ...track, status: "generated" });
      await updateAlbum(alb.id, {
        tracks: [...done, ...alb.tracks.slice(i + 1)],
      });
    }
  } finally {
    busy = false;
  }
  status.textContent = "";
  // Only repaint if the user is still on this album (they may have opened another).
  if (currentAlbumId === alb.id) renderAlbumTracks(await getAlbum(alb.id));
}

// Stage C — generated tracks with per-field copy + paste.
function renderAlbumTracks(alb) {
  const c = $a("album-stage-c");
  c.textContent = "";
  c.appendChild(albumTitleBar(alb));

  const copyAll = el("button", "btn", "Copy whole album");
  copyAll.addEventListener("click", () => {
    const text = alb.tracks
      .map(
        (t, i) =>
          `#${i + 1} ${t.title || ""}\nSTYLE: ${t.style}\nEXCLUDE: ${t.exclude || ""}\n${t.lyrics || ""}`,
      )
      .join("\n\n");
    copyAndFlash(copyAll, text);
  });
  c.appendChild(copyAll);

  alb.tracks.forEach((t, i) => c.appendChild(buildAlbumTrackCard(t, i)));
}

function buildAlbumTrackCard(t, i) {
  const card = el("div", "track-card");

  const patchTrack = async (patch) => {
    const s = await getAlbum(currentAlbumId);
    const tracks = s.tracks.map((tt, idx) =>
      idx === i ? { ...tt, ...patch } : tt,
    );
    await updateAlbum(currentAlbumId, { tracks });
  };

  card.appendChild(el("strong", "track-state", `#${i + 1} · ${t.bpm || ""}`));

  const titleWrap = el("div", "name-row");
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.className = "track-title";
  titleInput.value = t.title || "";
  titleInput.addEventListener("change", () =>
    patchTrack({ title: titleInput.value }),
  );
  const copyTitle = el("button", "btn", "Copy");
  copyTitle.addEventListener("click", () =>
    copyAndFlash(copyTitle, titleInput.value),
  );
  titleWrap.append(titleInput, copyTitle);
  card.appendChild(titleWrap);

  const style = el("p", "", t.style || "");
  card.appendChild(style);
  const copyStyle = el("button", "btn", "Copy style");
  copyStyle.addEventListener("click", () =>
    copyAndFlash(copyStyle, t.style || ""),
  );
  const styleRow = el("div", "btn-row");
  styleRow.appendChild(copyStyle);
  card.appendChild(styleRow);

  if (t.exclude) {
    card.appendChild(el("p", "hint", `Exclude: ${t.exclude}`));
    const copyExc = el("button", "btn", "Copy exclude");
    copyExc.addEventListener("click", () => copyAndFlash(copyExc, t.exclude));
    const excRow = el("div", "btn-row");
    excRow.appendChild(copyExc);
    card.appendChild(excRow);
  }

  card.appendChild(el("div", "hint", "Lyrics"));
  const lyrics = document.createElement("textarea");
  lyrics.className = "track-lyrics";
  lyrics.rows = 6;
  lyrics.value = t.lyrics || "";
  lyrics.addEventListener("change", () => patchTrack({ lyrics: lyrics.value }));
  card.appendChild(lyrics);
  const copyLyrics = el("button", "btn", "Copy lyrics");
  copyLyrics.addEventListener("click", () =>
    copyAndFlash(copyLyrics, lyrics.value),
  );
  const lyricsRow = el("div", "btn-row");
  lyricsRow.appendChild(copyLyrics);
  card.appendChild(lyricsRow);

  const regen = el("button", "btn", "Regenerate");
  regen.addEventListener("click", () => regenerateOne(i));
  const paste = el("button", "btn primary", "Paste → Suno");
  paste.addEventListener("click", async () => {
    const s = await getAlbum(currentAlbumId);
    await pasteAlbumTrack(s.tracks[i]);
  });
  const actions = el("div", "btn-row");
  actions.append(regen, paste);
  card.appendChild(actions);

  return card;
}

async function regenerateOne(i) {
  if (busy) return; // don't race another in-flight generation
  busy = true;
  try {
    const alb = await getAlbum(currentAlbumId);
    const { apiKey, model } = await getSettings();
    const track = await generateAlbumTrack({
      album: alb,
      brief: alb.tracks[i].brief,
      apiKey,
      model,
    });
    const tracks = alb.tracks.map((tt, idx) =>
      idx === i ? { ...tt, ...track, status: "generated" } : tt,
    );
    await updateAlbum(currentAlbumId, { tracks });
    renderAlbumTracks(await getAlbum(currentAlbumId));
  } finally {
    busy = false;
  }
}

// Fill an open suno.com tab with one album track (title/style/exclude/lyrics +
// slider recs). Same inject-retry dance as the other paste paths.
async function pasteAlbumTrack(track) {
  const setStatus = (t) => ($a("album-status").textContent = t);
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
    title: track.title || "",
    style: track.style || "",
    exclude: track.exclude || "",
    lyrics: track.lyrics || "",
    weirdness: track.weirdness || "",
    styleInfluence: track.styleInfluence || "",
  };
  let resp;
  try {
    resp = await chrome.tabs.sendMessage(tabId, payload);
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["suno-fill.js"],
      });
      resp = await chrome.tabs.sendMessage(tabId, payload);
    } catch {
      setStatus("Couldn't reach the Suno tab — reload suno.com and retry.");
      return;
    }
  }
  if (resp && resp.ok) {
    chrome.tabs.update(tabId, { active: true });
    const values = {
      weirdness: track.weirdness,
      styleInfluence: track.styleInfluence,
    };
    const sliderResult = await driveSunoSliders(tabId, values);
    setStatus(sliderPasteMessage(sliderResult, values));
  } else {
    setStatus((resp && resp.error) || "Couldn't fill Suno's fields.");
  }
}
