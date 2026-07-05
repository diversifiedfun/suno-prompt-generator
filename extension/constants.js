// constants.js — tiny shared constants with no heavy dependencies.
// Kept separate so the background service worker can import DEFAULT_MODEL via
// storage.js WITHOUT pulling in generator.js + knowledge.js on every SW restart.

export const DEFAULT_MODEL = "claude-sonnet-4-6";

// Restrict captured/source URLs to safe schemes (defense in depth at rest).
export function isSafeHttpUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
