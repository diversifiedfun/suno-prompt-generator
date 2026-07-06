// storage.js — chrome.storage.local persistence, per-key schema.
// Each prompt is stored under key `prompt_<id>` so reads/writes are
// isolated — avoids the one-array-append-race that would corrupt saves.
import { DEFAULT_MODEL, isSafeHttpUrl } from "./constants.js";

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

// --- Prompt CRUD -----------------------------------------------------------

export async function addPrompt({ text, title, tags, sourceUrl, source }) {
  const id = crypto.randomUUID();
  const record = {
    id,
    text: String(text || "").trim(),
    title: String(title || "").trim(),
    // Tags stored as array; callers may pass comma-string or array
    tags: Array.isArray(tags)
      ? tags.map((t) => String(t).trim()).filter(Boolean)
      : String(tags || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
    // Only persist http/https source URLs — drop anything else (javascript:, data:)
    // so the stored value is clean at rest, not just guarded at render time.
    sourceUrl: isSafeHttpUrl(String(sourceUrl || "").trim())
      ? String(sourceUrl).trim()
      : "",
    source: String(source || "captured"),
    createdAt: Date.now(),
  };
  await storageSet({ [`prompt_${id}`]: record });
  return record;
}

export async function getAllPrompts() {
  const all = await storageGetAll();
  const prompts = Object.entries(all)
    .filter(([key]) => key.startsWith("prompt_"))
    .map(([, val]) => val);
  // Newest first
  return prompts.sort((a, b) => b.createdAt - a.createdAt);
}

// Immutable merge — never mutates the stored object in place.
export async function updatePrompt(id, patch) {
  const key = `prompt_${id}`;
  const stored = await storageGet([key]);
  if (!stored[key]) throw new Error(`Prompt ${id} not found`);
  const updated = { ...stored[key], ...patch, id }; // id is immutable
  await storageSet({ [key]: updated });
  return updated;
}

export async function deletePrompt(id) {
  await storageRemove([`prompt_${id}`]);
}

// --- Settings ---------------------------------------------------------------
// Settings live under a single key. apiKey is NEVER logged.

const SETTINGS_KEY = "settings";

export async function getSettings() {
  const stored = await storageGet([SETTINGS_KEY]);
  return {
    apiKey: stored[SETTINGS_KEY]?.apiKey ?? "",
    model: stored[SETTINGS_KEY]?.model ?? DEFAULT_MODEL,
  };
}

export async function setSettings(patch) {
  const current = await getSettings();
  // Spread so callers can update one field without clobbering the other
  const next = { ...current, ...patch };
  // Guard: never accidentally log or expose apiKey in error messages
  await storageSet({ [SETTINGS_KEY]: next });
}

// --- UI state ---------------------------------------------------------------
// Remembers where the user was — active tab + in-progress Vibe and Build inputs
// and results — so reopening the side panel restores the session instead of
// resetting to a blank Vibe tab. The caller owns the shape and always writes the
// WHOLE object (never a read-modify-write patch), so rapid keystroke saves can't
// interleave and drop each other. Never holds the API key.

const UI_STATE_KEY = "uiState";

export async function getUiState() {
  const stored = await storageGet([UI_STATE_KEY]);
  const s = stored[UI_STATE_KEY];
  return s && typeof s === "object" ? s : {};
}

export async function saveUiState(state) {
  await storageSet({
    [UI_STATE_KEY]: state && typeof state === "object" ? state : {},
  });
}
