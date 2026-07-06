// album-storage.js — Album object CRUD under album_<id>. Immutable updates.
// Mirrors set-storage's pattern but for cohesive/concept albums (no energy arc).
// Kept separate so albums never collide with sets or prompts.

function aGet(keys) {
  return new Promise((resolve, reject) =>
    chrome.storage.local.get(keys, (r) =>
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(r),
    ),
  );
}
function aSet(items) {
  return new Promise((resolve, reject) =>
    chrome.storage.local.set(items, () =>
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(),
    ),
  );
}
function aRemove(keys) {
  return new Promise((resolve, reject) =>
    chrome.storage.local.remove(keys, () =>
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(),
    ),
  );
}
function aAll() {
  return new Promise((resolve, reject) =>
    chrome.storage.local.get(null, (r) =>
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(r),
    ),
  );
}

const key = (id) => `album_${id}`;

// Strictly-increasing timestamp so same-millisecond creates still sort
// deterministically newest-first.
let lastStamp = 0;
function monotonicNow() {
  const t = Date.now();
  lastStamp = t > lastStamp ? t : lastStamp + 1;
  return lastStamp;
}

const MODES = ["cohesive", "concept"];

export async function createAlbum({
  title,
  mode,
  seed,
  seedMode,
  soundDNA,
  exclude,
  trackCount,
} = {}) {
  const id = crypto.randomUUID();
  const now = monotonicNow();
  const record = {
    id,
    title: String(title || "").trim() || "Untitled album",
    mode: MODES.includes(mode) ? mode : "cohesive",
    // The user's seed and whether it was a vibe or an artist reference.
    seed: String(seed || "").trim(),
    seedMode: seedMode === "artist" ? "artist" : "vibe",
    // The shared sonic identity every track hangs off.
    soundDNA: String(soundDNA || "").trim(),
    exclude: String(exclude || "").trim(),
    trackCount: Number.isFinite(trackCount)
      ? Math.max(3, Math.min(20, trackCount))
      : 10,
    tracks: [],
    activeTrackIndex: 0,
    offline: false,
    offlineNote: "",
    createdAt: now,
    updatedAt: now,
  };
  await aSet({ [key(id)]: record });
  return record;
}

export async function getAllAlbums() {
  const all = await aAll();
  return Object.entries(all)
    .filter(([k]) => k.startsWith("album_"))
    .map(([, v]) => v)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAlbum(id) {
  const r = await aGet([key(id)]);
  return r[key(id)] || null;
}

export async function updateAlbum(id, patch) {
  const stored = await aGet([key(id)]);
  if (!stored[key(id)]) throw new Error(`Album ${id} not found`);
  const updated = {
    ...stored[key(id)],
    ...patch,
    id,
    updatedAt: monotonicNow(),
  };
  await aSet({ [key(id)]: updated });
  return updated;
}

export async function deleteAlbum(id) {
  await aRemove([key(id)]);
}
