import { describe, it, expect, vi } from "vitest";
import {
  driveSunoLyrics,
  chunkLyrics,
  collectPasteProblems,
  pasteProblemsMessage,
} from "./suno-lyrics-driver.js";

// Fake chrome API. executeScript answers the "collect" call with geometry and
// the "read" call with whatever the editor supposedly ended up holding — the
// two are told apart by the injected function's name, same trick the slider
// driver's tests use.
function makeApi({ geo, readBack, attachThrows, sendThrows, noEditor } = {}) {
  const calls = { send: [], attach: [], detach: [] };
  return {
    calls,
    scripting: {
      executeScript: vi.fn(async (opts) => {
        if (opts.func && opts.func.name === "readLyricsText")
          return [{ result: readBack }];
        if (noEditor) return [{ result: null }];
        return [{ result: geo || { x: 100, y: 200, existing: 0 } }];
      }),
    },
    debugger: {
      attach: vi.fn(async (t) => {
        calls.attach.push(t);
        if (attachThrows) throw new Error("attach boom");
      }),
      detach: vi.fn(async (t) => {
        calls.detach.push(t);
      }),
      sendCommand: vi.fn(async (t, method, params) => {
        calls.send.push({ method, params });
        if (sendThrows) throw new Error("send boom");
      }),
    },
  };
}

const LYRIC =
  "[Intro]\nKeep going\nI'm listening\n\n[Verse 1]\nYou're on the part now";

describe("chunkLyrics", () => {
  // 🔴 The invariant that matters is what the DRIVER produces: it inserts the
  // chunks back to back with no separator. The first version of this test
  // asserted join("\n"), which validated the splitter while the driver was
  // silently fusing the lines either side of every boundary (40 lines -> 36).
  it("rejoins with NO separator to exactly the original — what the driver does", () => {
    const text = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n");
    const parts = chunkLyrics(text, 60);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("")).toBe(text);
    expect(parts.join("").split("\n").length).toBe(40);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(60);
  });

  it("preserves blank lines between sections across a boundary", () => {
    const text = "[Verse]\na\nb\n\n[Chorus]\nc\nd\n\n[Bridge]\ne";
    const parts = chunkLyrics(text, 12);
    expect(parts.join("")).toBe(text);
  });

  // A lyric whose newlines were already stripped upstream is ONE huge line —
  // the line-boundary splitter alone would emit it as a single giant insert and
  // defeat the chunking entirely.
  it("hard-splits a single line longer than the chunk size", () => {
    const long = "x".repeat(1000);
    const parts = chunkLyrics(long, 350);
    expect(parts.length).toBe(3);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(350);
    expect(parts.join("")).toBe(long);
  });

  // Regression: the hard-split only runs when `cur` is empty. A long line
  // arriving AFTER a buffered short one still splits, because a line longer than
  // `size` always trips the flush first. Verified rather than assumed.
  it("hard-splits a long line even when a short line is buffered", () => {
    const src = "short line\n" + "x".repeat(1000);
    const parts = chunkLyrics(src, 350);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(350);
    expect(parts.join("")).toBe(src);
  });

  it("keeps a single short lyric in one chunk", () => {
    expect(chunkLyrics("a\nb", 350)).toEqual(["a\nb"]);
    expect(chunkLyrics("a\nb", 350).join("")).toBe("a\nb");
  });
});

describe("driveSunoLyrics", () => {
  it("writes via trusted CDP input and confirms it landed", async () => {
    const api = makeApi({ readBack: LYRIC });
    const r = await driveSunoLyrics(1, LYRIC, api);
    expect(r.ok).toBe(true);
    const methods = api.calls.send.map((c) => c.method);
    expect(methods).toContain("Input.dispatchMouseEvent"); // trusted click
    expect(methods).toContain("Input.insertText");
    expect(api.calls.detach.length).toBe(1); // banner always cleared
  });

  // THE regression this driver exists for. execCommand('insertText') inserted
  // the text but flattened 105 lines into 1; the old code would have called
  // that a successful paste. Verification must reject it.
  it("FAILS when the editor strips the line breaks", async () => {
    const flattened = LYRIC.replace(/\n/g, "");
    const api = makeApi({ readBack: flattened });
    const r = await driveSunoLyrics(1, LYRIC, api);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/line breaks/);
  });

  // Same line count, far less text — isolates the length check from the
  // line-break check, which would otherwise fire first on a truncated paste.
  it("FAILS when the lyric lands short", async () => {
    const api = makeApi({ readBack: "[Intro]\nK\nI\n\n[V]\nY" });
    const r = await driveSunoLyrics(1, LYRIC, api);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/short/);
  });

  it("FAILS on a truncated paste too (whatever the reason given)", async () => {
    const api = makeApi({ readBack: "[Intro]\nKeep going" });
    const r = await driveSunoLyrics(1, LYRIC, api);
    expect(r.ok).toBe(false);
  });

  // OBSERVED ON THE LIVE EDITOR 2026-09-01: selectAll+delete failed to clear and
  // the insert concatenated onto the leftovers — 2065 expected chars, 4130 present.
  // Both verification checks were lower-bound only, so that read as a clean pass.
  // Matters most in the multi-track flows (Set "Paste next", Album), where the
  // field always already holds the previous track.
  it("FAILS when the old lyric was not cleared and the new one concatenated", async () => {
    const api = makeApi({
      geo: { x: 1, y: 2, existing: LYRIC.length },
      readBack: LYRIC + "\n" + LYRIC,
    });
    const r = await driveSunoLyrics(1, LYRIC, api);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/left over|too much|not cleared/i);
  });

  // A single-line lyric makes the line-count check a no-op (wantLines === 1),
  // so the length check is the only gate — it must work in both directions.
  it("FAILS on leftovers even for a one-line lyric", async () => {
    const one = "just the one line";
    const api = makeApi({
      geo: { x: 1, y: 2, existing: 40 },
      readBack: "some other song's words " + one,
    });
    const r = await driveSunoLyrics(1, one, api);
    expect(r.ok).toBe(false);
  });

  it("reports when the editor isn't on the page", async () => {
    const api = makeApi({ noEditor: true });
    const r = await driveSunoLyrics(1, LYRIC, api);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not found/);
    expect(api.calls.attach.length).toBe(0); // no debugger banner for nothing
  });

  it("reports a failed debugger attach instead of claiming success", async () => {
    const api = makeApi({ attachThrows: true, readBack: LYRIC });
    const r = await driveSunoLyrics(1, LYRIC, api);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/attach/);
  });

  it("detaches even when the insert throws", async () => {
    const api = makeApi({ sendThrows: true, readBack: "" });
    const r = await driveSunoLyrics(1, LYRIC, api);
    expect(r.ok).toBe(false);
    expect(api.calls.detach.length).toBe(1);
  });

  it("clears existing content before writing, but not when empty", async () => {
    const withText = makeApi({
      geo: { x: 1, y: 2, existing: 500 },
      readBack: LYRIC,
    });
    await driveSunoLyrics(1, LYRIC, withText);
    expect(withText.calls.send.some((c) => c.params?.key === "Delete")).toBe(
      true,
    );

    const empty = makeApi({
      geo: { x: 1, y: 2, existing: 0 },
      readBack: LYRIC,
    });
    await driveSunoLyrics(1, LYRIC, empty);
    expect(empty.calls.send.some((c) => c.params?.key === "Delete")).toBe(
      false,
    );
  });

  it("does nothing (and attaches nothing) for an empty lyric", async () => {
    const api = makeApi({ readBack: "" });
    const r = await driveSunoLyrics(1, "   ", api);
    expect(r).toEqual({ ok: true, skipped: true });
    expect(api.calls.attach.length).toBe(0);
  });
});

// collectPasteProblems is shared by all three paste paths (sidepanel, album-tab,
// set-tab). The original regression survived because only one path was fixed.
describe("collectPasteProblems", () => {
  it("is empty for a genuinely clean paste", async () => {
    const api = makeApi({ readBack: LYRIC });
    const p = await collectPasteProblems(1, { ok: true, filled: ["style"] }, LYRIC, api);
    expect(p).toEqual([]);
    expect(pasteProblemsMessage(p)).toBe("");
    expect(api.calls.attach.length).toBe(0); // no contenteditable -> no debugger
  });

  it("drives the contenteditable when the content script flags one", async () => {
    const api = makeApi({ readBack: LYRIC });
    const p = await collectPasteProblems(1, { ok: true, needsTrustedInput: true }, LYRIC, api);
    expect(p).toEqual([]);
    expect(api.calls.send.some((c) => c.method === "Input.insertText")).toBe(true);
  });

  it("surfaces a lyrics write that did not land", async () => {
    const api = makeApi({ readBack: LYRIC.replace(/\n/g, "") });
    const p = await collectPasteProblems(1, { ok: true, needsTrustedInput: true }, LYRIC, api);
    expect(p.length).toBe(1);
    expect(p[0]).toMatch(/^lyrics —/);
    expect(pasteProblemsMessage(p)).toMatch(/Paste by hand/);
  });

  it("reports missing and not-stuck fields", async () => {
    const api = makeApi({ readBack: LYRIC });
    const p = await collectPasteProblems(
      1, { ok: true, missing: ["exclude"], notStuck: ["style"] }, LYRIC, api,
    );
    expect(p).toEqual(["exclude — field not found", "style — didn't stick"]);
  });

  it("tolerates a response from an old content script", async () => {
    const api = makeApi({ readBack: LYRIC });
    expect(await collectPasteProblems(1, { ok: true }, LYRIC, api)).toEqual([]);
    expect(await collectPasteProblems(1, undefined, LYRIC, api)).toEqual([]);
  });
});

describe("verification bounds", () => {
  const mk = (want, readBack) => ({
    scripting: {
      executeScript: async (o) => [
        {
          result:
            o.func.name === "readLyricsText"
              ? readBack
              : { x: 1, y: 2, existing: want.length },
        },
      ],
    },
    debugger: {
      attach: async () => {},
      detach: async () => {},
      sendCommand: async () => {},
    },
  });

  // A pure 5% ratio left ~103 chars of headroom at real song length — enough to
  // hide a whole leftover LINE of the previous track. The absolute cap closes it.
  it("rejects a partial leftover that a pure ratio would have passed", async () => {
    const want = "L".repeat(2065);
    const got = "leftover chorus line from the last song" + want; // +39
    expect(got.length).toBeLessThan(want.length * 1.05); // ratio alone: passes
    const r = await driveSunoLyrics(1, want, mk(want, got));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/left over/);
  });

  it("still accepts a clean write at song length", async () => {
    const want = "L".repeat(2065);
    const r = await driveSunoLyrics(1, want, mk(want, want));
    expect(r.ok).toBe(true);
  });

  // Both defects at once: the leftover message must not bury the line-break loss,
  // because "clear the box and retry" is wrong advice for a flattening bug.
  it("reports BOTH failures when both trip", async () => {
    const want = Array.from({ length: 100 }, () => "abcdefghijklmnopqrstuvwxyz").join("\n");
    const got = "x".repeat(want.length + 400).replace(/x{60}/g, (m) => m + "\n");
    const r = await driveSunoLyrics(1, want, mk(want, got));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/line breaks/);
    expect(r.error).toMatch(/left over/);
  });
});
