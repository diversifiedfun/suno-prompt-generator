// wav-download.js — the WAV tab. Pulls every track of a Suno playlist, in
// playlist order, converts each to WAV using the user's own logged-in Suno
// session, and downloads them as numbered files into a folder named after
// the playlist. Talks to Suno's reverse-engineered studio-api-prod
// endpoints; the Bearer token is fetched live from the page's Clerk session
// on every run — never stored, never logged.
import { el } from "./dom-utils.js";

const PLAYLIST_BASE = "https://studio-api-prod.suno.com/api/playlist";
const GEN_BASE = "https://studio-api-prod.suno.com/api/gen";
const MAX_PLAYLIST_PAGES = 200;
const WAV_POLL_INTERVAL_MS = 2000;
const WAV_POLL_TIMEOUT_MS = 90000;
const LOGIN_MESSAGE = "Open suno.com and log in first, then try again.";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const FORBIDDEN_FILENAME_CHARS = /[\\/:*?"<>|\x00-\x1f\x7f]/g;

// ---------------------------------------------------------------------------
// Pure helpers — unit-tested in wav-download.test.js
// ---------------------------------------------------------------------------

// Extract a playlist UUID from a full URL, a bare id, or either with a
// trailing slash/query string. Returns null (never throws) on bad input.
export function parsePlaylistId(urlOrId) {
  const s = String(urlOrId ?? "").trim();
  if (!s) return null;
  const match = s.match(UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

// Strip characters that are invalid (or awkward) in a filesystem path,
// collapse whitespace, and trim stray leading/trailing dots. Falls back to
// `fallback` when nothing usable survives.
export function sanitizeFilename(name, fallback = "untitled") {
  const cleaned = String(name ?? "")
    .replace(FORBIDDEN_FILENAME_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+|\.+$/g, "")
    .trim();
  return cleaned || fallback;
}

// "NN - Title.wav" — `index` and `total` are 1-based display values. The
// zero-pad width is max(2, digits in `total`), so a 9-track playlist still
// gets "01", "02"… while a 100-track one gets "001", "002"…
export function trackFilename(index, total, title) {
  const width = Math.max(2, String(total).length);
  const nn = String(index).padStart(width, "0");
  const safeTitle = sanitizeFilename(title, `Track ${nn}`);
  return `${nn} - ${safeTitle}.wav`;
}

// ---------------------------------------------------------------------------
// Suno API + chrome integration — not unit-tested (no browser in vitest);
// exercised by a real download run against Molly's own Suno session.
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Recursively hunt a parsed JSON value for the first https:// string —
// handles both a top-level `{ url: "..." }` shape and anything shaped
// differently without guessing field names.
function findFirstUrlString(value) {
  if (typeof value === "string") {
    return /^https?:\/\//.test(value) ? value : null;
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = findFirstUrlString(v);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    if (typeof value.url === "string" && /^https?:\/\//.test(value.url)) {
      return value.url;
    }
    for (const v of Object.values(value)) {
      const found = findFirstUrlString(v);
      if (found) return found;
    }
  }
  return null;
}

async function findSunoTab() {
  const tabs = await chrome.tabs.query({ url: "https://suno.com/*" });
  return tabs[0] || null;
}

// Pull a fresh Clerk session token from the page's MAIN world. Cookie-only
// requests to the WAV endpoints 401, so this is the only way in.
async function getSunoToken(tabId) {
  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: async () => {
        try {
          return await window.Clerk.session.getToken();
        } catch {
          return null;
        }
      },
    });
  } catch (err) {
    console.error("[Suno WAV] Token fetch failed:", err);
    return null;
  }
  return results?.[0]?.result ?? null;
}

// A token provider that caches the Clerk token but refreshes it when it ages
// out (Clerk tokens have a ~60s TTL) or when forced. getToken(true) forces a
// fresh pull. Keeps a long multi-track run from dying on an expired token.
function makeTokenProvider(tabId) {
  let token = null;
  let fetchedAt = 0;
  return async (force = false) => {
    if (force || !token || Date.now() - fetchedAt > 45000) {
      token = await getSunoToken(tabId);
      fetchedAt = Date.now();
    }
    return token;
  };
}

// Fetch with a Bearer token; on a 401 refresh the token once and retry, so a
// token that expired mid-run recovers transparently. 30s per-request timeout
// so a hung connection can never wedge the run.
async function authedFetch(url, init, getToken) {
  const build = (tok) => ({
    ...init,
    headers: { ...(init && init.headers), Authorization: `Bearer ${tok}` },
    signal: AbortSignal.timeout(30000),
  });
  let token = await getToken();
  let res = await fetch(url, build(token));
  if (res.status === 401) {
    token = await getToken(true); // force a fresh token, then retry once
    if (token) res = await fetch(url, build(token));
  }
  return res;
}

// Paginate the (public, unauthenticated) playlist listing until every clip
// is collected, an empty page is returned, or the hard page cap is hit.
async function fetchPlaylistClips(playlistId) {
  let clips = [];
  let name = "";
  let expectedTotal = null;
  for (let page = 1; page <= MAX_PLAYLIST_PAGES; page++) {
    const res = await fetch(`${PLAYLIST_BASE}/${playlistId}/?page=${page}`, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      throw new Error(`Couldn't load the playlist (HTTP ${res.status}).`);
    }
    const data = await res.json();
    if (page === 1) {
      name = data.name || "Suno Playlist";
      expectedTotal = Number(data.num_total_results) || 0;
    }
    const pageClips = Array.isArray(data.playlist_clips)
      ? data.playlist_clips
      : [];
    if (!pageClips.length) break;
    clips = [...clips, ...pageClips];
    if (expectedTotal !== null && clips.length >= expectedTotal) break;
  }
  const tracks = clips
    .map((pc) => pc?.clip)
    .filter(Boolean)
    .map((clip) => ({ id: clip.id, title: clip.title || "Untitled" }));
  return { name, tracks };
}

async function requestWavConversion(clipId, getToken) {
  // Idempotent on Suno's side. Non-fatal on its own — the poll loop is the
  // real source of truth — but log a distinct message if it's rejected.
  try {
    const res = await authedFetch(
      `${GEN_BASE}/${clipId}/convert_wav/`,
      { method: "POST" },
      getToken,
    );
    if (!res.ok) {
      console.warn(`[Suno WAV] convert_wav ${clipId} → HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn(`[Suno WAV] convert_wav kick failed for ${clipId}:`, err);
  }
}

// Poll wav_file once. Returns { url, revoke } when ready, null when not yet
// ready (404/409/425 — caller retries). `revoke: true` means `url` is a blob:
// URL this tab created and must eventually release. Throws on a persistent
// 401 (session genuinely gone) so the caller fails fast with a clear message
// instead of a misleading 90s timeout.
async function fetchWavPayload(clipId, getToken) {
  const res = await authedFetch(
    `${GEN_BASE}/${clipId}/wav_file/`,
    {},
    getToken,
  );
  if (res.status === 401) {
    throw new Error("Suno session expired — reload suno.com and try again.");
  }
  if (!res.ok) return null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("audio")) {
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), revoke: true };
  }
  const data = await res.json().catch(() => null);
  const url = data ? findFirstUrlString(data) : null;
  return url ? { url, revoke: false } : null;
}

async function waitForWav(clipId, getToken) {
  await requestWavConversion(clipId, getToken);
  const deadline = Date.now() + WAV_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const payload = await fetchWavPayload(clipId, getToken);
    if (payload) return payload;
    await sleep(WAV_POLL_INTERVAL_MS);
  }
  throw new Error("WAV conversion never finished (timed out after 90s).");
}

function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      { url, filename, conflictAction: "uniquify" },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (downloadId === undefined) {
          reject(new Error("Download didn't start."));
        } else {
          resolve(downloadId);
        }
      },
    );
  });
}

// Downloads a whole playlist as numbered WAVs. Sequential (politeness +
// correct numbering) — one track failing never stops the rest. Calls
// `onProgress({ index, total, title, state, error? })` as each track moves
// through converting → downloading → done/failed. Returns a summary object.
export async function downloadPlaylistAsWav(urlOrId, { onProgress } = {}) {
  const playlistId = parsePlaylistId(urlOrId);
  if (!playlistId) {
    throw new Error("Couldn't find a playlist id in that URL.");
  }

  const tab = await findSunoTab();
  if (!tab) throw new Error(LOGIN_MESSAGE);
  const getToken = makeTokenProvider(tab.id);
  if (!(await getToken())) throw new Error(LOGIN_MESSAGE); // guard: not logged in

  const { name, tracks } = await fetchPlaylistClips(playlistId);
  if (!tracks.length) {
    throw new Error("That playlist has no tracks (or couldn't be read).");
  }
  const folder = sanitizeFilename(name, "Suno Playlist");
  const total = tracks.length;

  const results = [];
  for (let i = 0; i < total; i++) {
    const track = tracks[i];
    const index = i + 1;
    onProgress?.({ index, total, title: track.title, state: "converting" });
    try {
      const payload = await waitForWav(track.id, getToken);
      onProgress?.({ index, total, title: track.title, state: "downloading" });
      const filename = `${folder}/${trackFilename(index, total, track.title)}`;
      try {
        await downloadFile(payload.url, filename);
      } finally {
        // Always release a blob: URL we created — even if the download threw.
        // (A JSON-sourced payload has revoke:false, so this is a no-op there.)
        if (payload.revoke) {
          setTimeout(() => URL.revokeObjectURL(payload.url), 60000);
        }
      }
      results.push({ index, title: track.title, ok: true });
      onProgress?.({ index, total, title: track.title, state: "done" });
    } catch (err) {
      console.error(`[Suno WAV] Track ${index} (${track.title}) failed:`, err);
      results.push({
        index,
        title: track.title,
        ok: false,
        error: err.message,
      });
      onProgress?.({
        index,
        total,
        title: track.title,
        state: "failed",
        error: err.message,
      });
    }
  }

  const downloaded = results.filter((r) => r.ok).length;
  const failed = results.length - downloaded;
  return { folder, total, downloaded, failed, results };
}

// ---------------------------------------------------------------------------
// UI wiring — mirrors set-tab.js / album-tab.js's dataset.init guard so
// re-activating the tab doesn't double-bind the click handler.
// ---------------------------------------------------------------------------

const $w = (id) => document.getElementById(id);
const PLAYLIST_URL_RE = /^https:\/\/suno\.com\/playlist\//i;

export function renderWavTab() {
  const startBtn = $w("wav-start");
  if (!startBtn) return; // defensive — panel markup absent
  if (startBtn.dataset.init) {
    prefillFromActiveTab();
    return;
  }
  startBtn.dataset.init = "1";
  startBtn.addEventListener("click", onStartClick);
  prefillFromActiveTab();
}

// If the user already has a suno.com playlist tab open, prefill the input
// so the common case is a single click. Never overwrites text they typed.
async function prefillFromActiveTab() {
  const input = $w("wav-url");
  if (!input || input.value.trim()) return;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.url && PLAYLIST_URL_RE.test(tab.url)) {
      input.value = tab.url;
    }
  } catch (err) {
    console.warn("[Suno WAV] Active-tab prefill skipped:", err);
  }
}

let busy = false;

async function onStartClick() {
  if (busy) return; // one download run at a time
  const input = $w("wav-url");
  const status = $w("wav-status");
  const list = $w("wav-list");
  const startBtn = $w("wav-start");
  const urlOrId = input?.value.trim() || "";

  list.textContent = "";
  status.textContent = "";
  status.classList.remove("warn");

  busy = true;
  startBtn.disabled = true;
  try {
    status.textContent = "Reading the playlist…";
    const rows = new Map();
    const summary = await downloadPlaylistAsWav(urlOrId, {
      onProgress: (progress) => {
        renderTrackRow(list, rows, progress);
        status.textContent = `Track ${progress.index} of ${progress.total}…`;
      },
    });
    status.textContent = `Done — ${summary.folder} (${summary.downloaded} downloaded · ${summary.failed} failed)`;
  } catch (err) {
    console.error("[Suno WAV] Playlist download failed:", err);
    status.textContent = err.message || "Something went wrong.";
    status.classList.add("warn");
  } finally {
    busy = false;
    startBtn.disabled = false;
  }
}

const STATE_ICON = {
  converting: "⏳",
  downloading: "⬇",
  done: "✓",
  failed: "✗",
};

function renderTrackRow(list, rows, progress) {
  let row = rows.get(progress.index);
  if (!row) {
    row = el("div", "myset-row");
    const info = el("div", "myset-info");
    info.appendChild(
      el("strong", "", progress.title || `Track ${progress.index}`),
    );
    info.appendChild(el("span", "hint wav-track-status", ""));
    row.appendChild(info);
    rows.set(progress.index, row);
    list.appendChild(row);
  }
  const statusEl = row.querySelector(".wav-track-status");
  const icon = STATE_ICON[progress.state] || "•";
  statusEl.textContent =
    progress.state === "failed"
      ? `${icon} failed: ${progress.error || "unknown error"}`
      : `${icon} ${progress.state}`;
  statusEl.classList.toggle("wav-track-fail", progress.state === "failed");
  statusEl.classList.toggle("wav-track-ok", progress.state === "done");
}
