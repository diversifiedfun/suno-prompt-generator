// suno-fill.js — content script on suno.com. Fills the Style-of-Music and Lyrics
// fields from a message; NEVER submits. Fails loudly if fields aren't found so a
// Suno redesign surfaces as a toast, not a silent no-op. This is the only file
// coupled to Suno's DOM — a redesign is a one-file fix.

// Ordered candidate selectors — logged-in /create workspace first (the real
// target, verified against the live DOM 2026-07-03), then the logged-out
// landing widget, then generic fallbacks. Suno ships two different DOMs:
// the full create page uses a styles wrapper + `lyrics-textarea`; the landing
// mini-widget uses `tag-input-textarea` / `lyrics-input-textarea`.
const STYLE_SELECTORS = [
  '[data-testid="create-form-styles-wrapper"] textarea',
  'textarea[data-testid="tag-input-textarea"]',
  'textarea[placeholder*="style" i]',
  'textarea[aria-label*="style" i]',
  'input[placeholder*="style of music" i]',
];
const LYRICS_SELECTORS = [
  'textarea[data-testid="lyrics-textarea"]',
  'textarea[data-testid="lyrics-input-textarea"]',
  'textarea[placeholder*="lyrics" i]',
  'textarea[aria-label*="lyrics" i]',
];

function findField(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

// React-controlled inputs need the native setter + an input event to register.
function setNativeValue(el, value) {
  const proto =
    el.tagName === "TEXTAREA"
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

// Idempotent install: the side panel re-injects this file into stale tabs via
// chrome.scripting, so guard against registering the listener twice (which would
// double-fill the fields).
if (!window.__sunoFillInstalled) {
  window.__sunoFillInstalled = true;
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== "suno-fill") return;
    const styleEl = findField(STYLE_SELECTORS);
    const lyricsEl = findField(LYRICS_SELECTORS);
    if (!styleEl) {
      sendResponse({
        ok: false,
        error:
          "Couldn't find Suno's Style box. Open the Create page and switch to Custom mode, then retry.",
      });
      return true;
    }
    setNativeValue(styleEl, msg.style || "");
    if (lyricsEl && msg.lyrics) setNativeValue(lyricsEl, msg.lyrics);
    styleEl.scrollIntoView({ behavior: "smooth", block: "center" });
    sendResponse({ ok: true });
    return true; // async-safe
  });
}
