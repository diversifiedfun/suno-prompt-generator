// gen-history.js — chrome.storage.local persistence for the Generate tab's
// history log. Mirrors storage.js's per-key `vibe_<id>` pattern: each
// generation is stored under its own `genhist_<id>` key so reads/writes are
// isolated (no one-array-append race). Caps at MAX_RECORDS newest entries so
// storage can't grow unbounded.

// --- Promise wrapper --------------------------------------------------------
// chrome.storage.local uses callbacks; wrapping once keeps callers clean.

function storageGet(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

function storageSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

function storageRemove(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

function storageGetAll() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(null, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

// --- Generation history CRUD -------------------------------------------------

const MAX_RECORDS = 50;

// Strictly-increasing timestamp so two generations logged in the same
// millisecond still sort deterministically newest-first (mirrors storage.js's
// vibeNow()).
let lastGenStamp = 0;
function genHistNow() {
  const t = Date.now();
  lastGenStamp = t > lastGenStamp ? t : lastGenStamp + 1;
  return lastGenStamp;
}

export async function addGeneration({
  mode,
  input,
  subject,
  instrumental,
  result,
} = {}) {
  const id = crypto.randomUUID();
  const record = {
    id,
    createdAt: genHistNow(),
    mode: mode === "artist" ? "artist" : "vibe",
    input: String(input || "").trim(),
    subject: String(subject || "").trim(),
    instrumental: Boolean(instrumental),
    result: result && typeof result === "object" ? result : {},
  };
  await storageSet({ [`genhist_${id}`]: record });
  await enforceCap();
  return record;
}

// Keep only the MAX_RECORDS newest entries — drop anything older.
async function enforceCap() {
  const all = await getAllGenerations();
  if (all.length <= MAX_RECORDS) return;
  const overflowKeys = all.slice(MAX_RECORDS).map((r) => `genhist_${r.id}`);
  await storageRemove(overflowKeys);
}

export async function getAllGenerations() {
  const all = await storageGetAll();
  return Object.entries(all)
    .filter(([key]) => key.startsWith("genhist_"))
    .map(([, val]) => val)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function deleteGeneration(id) {
  await storageRemove([`genhist_${id}`]);
}

export async function clearGenerations() {
  const all = await storageGetAll();
  const keys = Object.keys(all).filter((key) => key.startsWith("genhist_"));
  await storageRemove(keys);
}
