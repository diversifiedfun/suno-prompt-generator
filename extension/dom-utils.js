// dom-utils.js — tiny DOM helpers shared by the Build tab (sidepanel.js) and the
// Set tab (set-tab.js). Moved out of sidepanel.js verbatim during the Set-tab split.

// Safe text node — never use innerHTML with user data.
export function txt(str) {
  return document.createTextNode(String(str ?? ""));
}

// Create an element with optional class and textContent.
export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = String(text);
  return e;
}

// Copy text to clipboard and flash a "Copied" class on the button.
export async function copyAndFlash(btn, text) {
  try {
    await navigator.clipboard.writeText(text);
    btn.classList.add("copied");
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => {
      btn.classList.remove("copied");
      btn.textContent = orig;
    }, 1400);
  } catch {
    // Clipboard failure is non-fatal; silently skip the flash.
  }
}

// Guard sourceUrl — only http/https hrefs allowed to prevent javascript: injection.
export function safeHref(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

// Filter an optgroup-structured <select> by a query, hiding non-matching options
// and empty groups.
export function filterSelectOptions(select, query) {
  const q = query.trim().toLowerCase();
  for (const og of select.querySelectorAll("optgroup")) {
    let anyVisible = false;
    for (const opt of og.querySelectorAll("option")) {
      const match = !q || opt.textContent.toLowerCase().includes(q);
      opt.hidden = !match;
      if (match) anyVisible = true;
    }
    og.hidden = !anyVisible;
  }
}
