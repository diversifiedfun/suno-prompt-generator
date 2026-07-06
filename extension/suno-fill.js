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
// Song-title field — best-effort only (Suno has hidden it behind an "advanced"
// toggle before). If it's not on screen we skip it rather than fail the paste.
const TITLE_SELECTORS = [
  'input[data-testid="create-form-title-input"]',
  'input[placeholder*="title" i]',
  'input[aria-label*="title" i]',
];
// Exclude-styles field (Custom mode). Best-effort — skipped if not present.
const EXCLUDE_SELECTORS = [
  'textarea[data-testid="excluded-styles-textarea"]',
  'textarea[placeholder*="exclude" i]',
  'textarea[aria-label*="exclude" i]',
  'input[placeholder*="exclude" i]',
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

// Best-effort slider setter: match a native range input by its aria-label
// keyword and set it. Suno's Weirdness / Style Influence controls may be custom
// (non-range) widgets — if so this finds nothing and skips, so paste never fails
// on their account. Returns true only if a slider was actually set.
function setSlider(keyword, pct) {
  const val = String(pct == null ? "" : pct).trim();
  if (val === "") return false;
  for (const r of document.querySelectorAll('input[type="range"]')) {
    const aria = (r.getAttribute("aria-label") || "").toLowerCase();
    if (aria.includes(keyword)) {
      setNativeValue(r, val);
      return true;
    }
  }
  return false;
}

function sunoFillHandler(msg, _sender, sendResponse) {
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
  if (msg.title) {
    const titleEl = findField(TITLE_SELECTORS);
    if (titleEl) setNativeValue(titleEl, msg.title);
  }
  if (msg.exclude) {
    const excludeEl = findField(EXCLUDE_SELECTORS);
    if (excludeEl) setNativeValue(excludeEl, msg.exclude);
  }
  // Best-effort sliders (may be no-ops if Suno uses custom widgets).
  setSlider("weird", msg.weirdness);
  setSlider("influence", msg.styleInfluence);
  styleEl.scrollIntoView({ behavior: "smooth", block: "center" });
  sendResponse({ ok: true });
  return true; // async-safe
}

// Install with a handler-ref swap, NOT a one-shot boolean guard. After an
// extension RELOAD, an already-open suno.com tab keeps an orphaned copy of this
// script whose chrome.runtime is dead; the old boolean guard then blocked the
// side panel's re-injection, so paste failed ("Couldn't reach the Suno tab")
// until a manual page reload. Swapping the stored handler guarantees exactly one
// LIVE listener on every (re)injection — no double-fill, no dead listener.
if (window.__sunoFillHandler) {
  try {
    chrome.runtime.onMessage.removeListener(window.__sunoFillHandler);
  } catch {
    // Old handler belonged to a dead context — nothing to remove.
  }
}
window.__sunoFillHandler = sunoFillHandler;
chrome.runtime.onMessage.addListener(sunoFillHandler);
