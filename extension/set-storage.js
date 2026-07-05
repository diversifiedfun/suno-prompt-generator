// set-storage.js — first-class Set object CRUD under set_<id>. Immutable updates.
// Mirrors storage.js's promise-wrapped chrome.storage.local pattern; kept separate
// so playlists never collide with prompt_ records.

function sGet(keys) {
  return new Promise((resolve, reject) =>
    chrome.storage.local.get(keys, (r) =>
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(r),
    ),
  );
}
function sSet(items) {
  return new Promise((resolve, reject) =>
    chrome.storage.local.set(items, () =>
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(),
    ),
  );
}
function sRemove(keys) {
  return new Promise((resolve, reject) =>
    chrome.storage.local.remove(keys, () =>
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(),
    ),
  );
}
function sAll() {
  return new Promise((resolve, reject) =>
    chrome.storage.local.get(null, (r) =>
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(r),
    ),
  );
}

const key = (id) => `set_${id}`;

// Monotonic timestamp: strictly increasing within a session so newest-first
// sorting is deterministic even when two sets are created in the same millisecond
// (Date.now() resolution ties otherwise). Still a real-ish epoch ms; resets to 0
// on service-worker restart, where Date.now() dominates anyway.
let lastStamp = 0;
function monotonicNow() {
  const t = Date.now();
  lastStamp = t > lastStamp ? t : lastStamp + 1;
  return lastStamp;
}

export async function createSet({
  title,
  presetKey,
  maturity,
  concept,
  subChoices,
  vibe,
  theme,
  scene,
  story,
  genres,
  trackCount,
  trackLength,
  forceLyrics,
  motif,
} = {}) {
  const id = crypto.randomUUID();
  const now = monotonicNow();
  const record = {
    id,
    title: String(title || "").trim() || "Untitled set",
    presetKey: String(presetKey || ""),
    maturity: String(maturity || ""),
    concept: String(concept || "").trim(),
    subChoices:
      subChoices && typeof subChoices === "object" ? { ...subChoices } : {},
    vibe: Array.isArray(vibe) ? [...vibe] : [],
    theme: String(theme || "").trim(),
    forceLyrics: !!forceLyrics,
    scene: String(scene || "").trim(),
    story: String(story || "").trim(),
    genres: Array.isArray(genres) ? [...genres] : [],
    motif: String(motif || "").trim(),
    trackCount: Number.isFinite(trackCount)
      ? Math.max(3, Math.min(60, trackCount))
      : 8,
    trackLength: ["standard", "extended", "dj-long"].includes(trackLength)
      ? trackLength
      : "standard",
    arcType: "",
    contour: [],
    conversation: [],
    tracks: [],
    activeTrackIndex: 0,
    offline: false,
    offlineNote: "",
    createdAt: now,
    updatedAt: now,
  };
  await sSet({ [key(id)]: record });
  return record;
}

export async function getAllSets() {
  const all = await sAll();
  return Object.entries(all)
    .filter(([k]) => k.startsWith("set_"))
    .map(([, v]) => v)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getSet(id) {
  const r = await sGet([key(id)]);
  return r[key(id)] || null;
}

export async function updateSet(id, patch) {
  const stored = await sGet([key(id)]);
  if (!stored[key(id)]) throw new Error(`Set ${id} not found`);
  const updated = {
    ...stored[key(id)],
    ...patch,
    id,
    updatedAt: monotonicNow(),
  };
  await sSet({ [key(id)]: updated });
  return updated;
}

export async function deleteSet(id) {
  await sRemove([key(id)]);
}

// ---------------------------------------------------------------------------
// Plan-form draft — the last set of choices the user made in the Set tab form,
// so the form is sticky across reloads and re-plans. Deliberately NOT under the
// `set_` prefix so getAllSets() never mistakes it for a real set record.
// ---------------------------------------------------------------------------
const DRAFT_KEY = "sbFormDraft";

export async function getFormDraft() {
  const r = await sGet([DRAFT_KEY]);
  return r[DRAFT_KEY] || null;
}

export async function saveFormDraft({
  presetKey,
  mode,
  vibe,
  theme,
  scene,
  keywords,
  story,
  genres,
  subChoices,
  runtimeMin,
  trackLength,
  trackCount,
  countOverride,
  blanks,
} = {}) {
  const draft = {
    presetKey: String(presetKey || ""),
    mode: mode === "story" ? "story" : "quick",
    vibe: Array.isArray(vibe) ? [...vibe] : [],
    theme: String(theme || ""),
    scene: String(scene || ""),
    keywords: String(keywords || ""),
    story: String(story || ""),
    genres: Array.isArray(genres) ? [...genres] : [],
    subChoices:
      subChoices && typeof subChoices === "object" ? { ...subChoices } : {},
    runtimeMin: Number.isFinite(runtimeMin) ? runtimeMin : 60,
    trackLength: ["standard", "extended", "dj-long"].includes(trackLength)
      ? trackLength
      : "standard",
    trackCount: Number.isFinite(trackCount) ? trackCount : 8,
    countOverride: Number.isFinite(countOverride) ? countOverride : null,
    blanks: blanks && typeof blanks === "object" ? { ...blanks } : {},
  };
  await sSet({ [DRAFT_KEY]: draft });
  return draft;
}
