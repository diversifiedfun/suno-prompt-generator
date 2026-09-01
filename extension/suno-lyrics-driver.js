// suno-lyrics-driver.js — writes the Lyrics field when Suno renders it as a
// contenteditable instead of a <textarea>.
//
// WHY THIS EXISTS (2026-09-01): Suno replaced the lyrics <textarea> with a rich
// editor (`div.lyrics-editor-content`). suno-fill.js's native-value-setter path
// only works on real form controls, so after the redesign the lyrics paste
// silently did nothing — Style filled, lyrics empty, no error. Measured against
// the live DOM: `textarea[data-testid="lyrics-textarea"]` no longer exists.
//
// Every synthetic write was tried against the live editor first and FAILED:
//   ClipboardEvent('paste') + DataTransfer  -> no-op, editor stays empty
//   execCommand('insertText', text)         -> inserts but STRIPS every newline
//                                              (2169 chars -> 2065, 105 lines -> 1)
//   execCommand('insertLineBreak')          -> no-op, and DOUBLED the content
//   execCommand('selectAll') + 'delete'     -> no-op, 4130 chars survived 6 tries
// A lyric with no line breaks is useless to Suno, so there is no partial win.
// Only TRUSTED input works, which is the same conclusion the sliders reached —
// hence the same chrome.debugger (CDP) route. See suno-slider-driver.js.
//
// Like the slider driver, this NEVER trusts the write: it re-reads the editor
// afterwards and only reports success if the text actually landed.

// Ordered candidates for Suno's rich lyrics editor. Class first (what the live
// DOM uses today), then structural fallbacks so a class rename doesn't kill it.
export const LYRICS_EDITABLE_SELECTORS = [
  ".lyrics-editor-content[contenteditable='true']",
  ".lyrics-editor-content",
  "[data-testid='lyrics-editor'] [contenteditable='true']",
  "[contenteditable='true'][role='textbox']",
];

// Typing is chunked so a huge lyric can't stall one CDP call. 350 chars matches
// what the manual keystroke path used successfully against this editor.
const CHUNK = 350;

// Fraction of the intended text that must be present afterwards to call it
// landed. Not 1.0: the editor normalises trailing whitespace and can collapse a
// final blank line, which is harmless.
const LAND_RATIO = 0.98;
// ...and an UPPER bound, because the checks have to fail in both directions.
// OBSERVED 2026-09-01: select-all+delete silently failed to clear the editor and
// the insert concatenated onto what was already there — 2065 expected chars,
// 4130 present. A lower-bound-only check calls that a clean paste. This bites
// hardest in the multi-track flows (Set "Paste next", Album), where the field
// always already holds the previous track. Slack above 1.0 covers the editor
// adding a trailing newline, nothing more.
const OVERSHOOT_RATIO = 1.05;

let driving = false;

// Injected via executeScript. Returns the editor's viewport geometry so CDP can
// click it, plus what it currently holds. Self-contained — no closure, no imports.
function collectLyricsTarget(selectors) {
  let el = null;
  for (const sel of selectors) {
    el = document.querySelector(sel);
    if (el) break;
  }
  if (!el) return null;
  el.scrollIntoView({ block: "center", inline: "nearest" });
  const b = el.getBoundingClientRect();
  if (!b.width || !b.height) return null;
  return {
    // Click near the top-left of the text area rather than dead centre: a long
    // existing lyric makes the centre land mid-document, and the caret position
    // decides where inserted text goes.
    x: b.left + Math.min(40, b.width / 2),
    y: b.top + Math.min(24, b.height / 2),
    existing: (el.innerText || "").trim().length,
  };
}

// Injected via executeScript. Reads back what the editor actually holds.
function readLyricsText(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) return el.innerText || "";
  }
  return null;
}

async function cdp(api, target, method, params) {
  return await api.debugger.sendCommand(target, method, params);
}

// A trusted click to place the caret, then select-all + delete so we replace
// rather than append. Both go through CDP; the editor ignores synthetic events.
async function focusAndClear(api, target, geo) {
  const base = { x: geo.x, y: geo.y, button: "left", clickCount: 1 };
  await cdp(api, target, "Input.dispatchMouseEvent", {
    type: "mousePressed",
    ...base,
  });
  await cdp(api, target, "Input.dispatchMouseEvent", {
    type: "mouseReleased",
    ...base,
  });
  if (!geo.existing) return;
  // Cmd/Ctrl+A then Delete. Chrome maps metaKey on macOS and ctrlKey elsewhere;
  // sending both modifiers in turn is simpler than sniffing the platform, and a
  // no-op select-all is harmless.
  for (const modifiers of [4, 2]) {
    await cdp(api, target, "Input.dispatchKeyEvent", {
      type: "keyDown",
      modifiers,
      key: "a",
      code: "KeyA",
      windowsVirtualKeyCode: 65,
    });
    await cdp(api, target, "Input.dispatchKeyEvent", {
      type: "keyUp",
      modifiers,
      key: "a",
      code: "KeyA",
      windowsVirtualKeyCode: 65,
    });
  }
  await cdp(api, target, "Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Delete",
    code: "Delete",
    windowsVirtualKeyCode: 46,
  });
  await cdp(api, target, "Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Delete",
    code: "Delete",
    windowsVirtualKeyCode: 46,
  });
}

// Split on line boundaries so a chunk never severs a line mid-word — the editor
// treats each insertText as its own edit and a split line can lose its break.
export function chunkLyrics(text, size = CHUNK) {
  const out = [];
  let cur = "";
  for (const line of String(text).split("\n")) {
    if (cur && cur.length + line.length + 1 > size) {
      out.push(cur);
      cur = "";
    }
    // A single line longer than the whole chunk would otherwise sail through as
    // one giant insert, defeating the chunking entirely — which is exactly the
    // shape a lyric takes if something upstream already flattened its newlines.
    // Hard-split it; there is no line boundary to be gentle about.
    if (!cur && line.length > size) {
      for (let i = 0; i < line.length; i += size)
        out.push(line.slice(i, i + size));
      continue;
    }
    cur += (cur ? "\n" : "") + line;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Post-paste completion, shared by ALL THREE paste paths (sidepanel, album-tab,
 * set-tab). They each send `suno-fill` and read the response, so a fix applied
 * to only one of them leaves the other two silently broken — which is exactly
 * how the lyrics regression survived: one code path was reviewed, three existed.
 *
 * Drives the contenteditable when the content script reports one, then collects
 * every field that was missing or didn't stick.
 * Returns a list of human-readable problems — empty means a genuinely clean paste.
 */
export async function collectPasteProblems(tabId, resp, lyrics, api = chrome) {
  const problems = [];
  if (resp && resp.needsTrustedInput) {
    const r = await driveSunoLyrics(tabId, lyrics, api);
    if (!r.ok && !r.skipped)
      problems.push(`lyrics — ${r.error || "didn't land"}`);
  }
  for (const f of (resp && resp.missing) || [])
    problems.push(`${f} — field not found`);
  for (const f of (resp && resp.notStuck) || [])
    problems.push(`${f} — didn't stick`);
  return problems;
}

/** Prefix for a status line; "" when there is nothing to warn about. */
export function pasteProblemsMessage(problems) {
  return problems && problems.length
    ? `Paste by hand: ${problems.join("; ")}. `
    : "";
}

/**
 * Fill Suno's contenteditable lyrics editor via trusted CDP input.
 * Returns { ok, error?, wrote?, expected? } and never throws.
 */
export async function driveSunoLyrics(tabId, lyrics, api = chrome) {
  const text = String(lyrics || "");
  if (!text.trim()) return { ok: true, skipped: true };
  if (driving) return { ok: false, error: "a lyrics paste is already running" };

  driving = true;
  try {
    let geo;
    try {
      const [res] = await api.scripting.executeScript({
        target: { tabId },
        func: collectLyricsTarget,
        args: [LYRICS_EDITABLE_SELECTORS],
      });
      geo = res && res.result;
    } catch {
      return { ok: false, error: "lyrics editor lookup failed" };
    }
    if (!geo) return { ok: false, error: "lyrics editor not found" };

    const target = { tabId };
    try {
      await api.debugger.attach(target, "1.3");
    } catch {
      return {
        ok: false,
        error: "debugger attach failed (DevTools open on the tab?)",
      };
    }
    try {
      await focusAndClear(api, target, geo);
      for (const part of chunkLyrics(text)) {
        await cdp(api, target, "Input.insertText", { text: part });
      }
    } catch {
      return { ok: false, error: "lyrics insert failed" };
    } finally {
      // Always detach so the "debugging this browser" banner clears.
      try {
        await api.debugger.detach(target);
      } catch {
        /* already detached / tab gone */
      }
    }

    // Verify — the whole point. Compare what the editor holds against what we
    // meant to write, on both length and line count, because the failure mode
    // that bit us was text landing with every newline stripped.
    try {
      const [res] = await api.scripting.executeScript({
        target: { tabId },
        func: readLyricsText,
        args: [LYRICS_EDITABLE_SELECTORS],
      });
      const want = text.trim();
      const got = ((res && res.result) || "").trim();
      const wantLines = want.split("\n").length;
      const gotLines = got.split("\n").length;
      const longEnough = got.length >= want.length * LAND_RATIO;
      const notTooMuch = got.length <= want.length * OVERSHOOT_RATIO;
      const keptBreaks = wantLines === 1 || gotLines >= wantLines * LAND_RATIO;
      if (longEnough && notTooMuch && keptBreaks) {
        return { ok: true, wrote: got.length };
      }
      let error;
      if (!notTooMuch) {
        // Almost always the previous track still sitting in the field.
        error =
          `lyrics left over from a previous paste ` +
          `(${got.length} chars present, expected ${want.length}) — clear the box and retry`;
      } else if (!keptBreaks) {
        error = `lyrics lost their line breaks (${gotLines}/${wantLines} lines)`;
      } else {
        error = `lyrics landed short (${got.length}/${want.length} chars)`;
      }
      return { ok: false, error, wrote: got.length, expected: want.length };
    } catch {
      return { ok: false, error: "couldn't verify the lyrics landed" };
    }
  } finally {
    driving = false;
  }
}
