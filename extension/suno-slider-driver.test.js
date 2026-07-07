import { describe, it, expect, vi } from "vitest";
import { driveSunoSliders, sliderPasteMessage } from "./suno-slider-driver.js";

// A fake chrome API. executeScript resolves to the given geometry; the debugger
// methods are spies so we can assert the CDP call sequence.
function makeApi({ geo, attachThrows, sendThrows, execThrows } = {}) {
  const calls = { send: [], attach: [], detach: [] };
  return {
    calls,
    scripting: {
      executeScript: vi.fn(async () => {
        if (execThrows) throw new Error("exec boom");
        return [{ result: geo }];
      }),
    },
    debugger: {
      attach: vi.fn(async (t, v) => {
        calls.attach.push([t, v]);
        if (attachThrows) throw new Error("attach boom");
      }),
      sendCommand: vi.fn(async (t, method, params) => {
        calls.send.push({ method, params });
        if (sendThrows) throw new Error("send boom");
      }),
      detach: vi.fn(async (t) => {
        calls.detach.push(t);
      }),
    },
  };
}

const GEO = [
  { key: "weirdness", y: 391, startX: 469, endX: 413 },
  { key: "styleInfluence", y: 391, startX: 469, endX: 496 },
];

describe("driveSunoSliders", () => {
  it("no-ops (no debugger, no banner) when no slider values are given", async () => {
    const api = makeApi({ geo: GEO });
    const r = await driveSunoSliders(1, {}, api);
    expect(r).toEqual({ ok: true, set: [] });
    expect(api.scripting.executeScript).not.toHaveBeenCalled();
    expect(api.debugger.attach).not.toHaveBeenCalled();
  });

  it("filters out blank / non-numeric values before touching the tab", async () => {
    const api = makeApi({ geo: GEO });
    const r = await driveSunoSliders(
      1,
      { weirdness: "", styleInfluence: "abc" },
      api,
    );
    expect(r).toEqual({ ok: true, set: [] });
    expect(api.debugger.attach).not.toHaveBeenCalled();
  });

  it("drives a trusted press→move→release drag per slider and detaches", async () => {
    const api = makeApi({ geo: GEO });
    const r = await driveSunoSliders(
      1,
      { weirdness: 20, styleInfluence: 66 },
      api,
    );
    expect(r).toEqual({ ok: true, set: ["weirdness", "styleInfluence"] });

    // executeScript got both targets (with their pct) to measure geometry.
    const execArgs = api.scripting.executeScript.mock.calls[0][0];
    expect(execArgs.target).toEqual({ tabId: 1 });
    expect(execArgs.args[0].map((t) => [t.key, t.pct])).toEqual([
      ["weirdness", 20],
      ["styleInfluence", 66],
    ]);

    expect(api.calls.attach).toEqual([[{ tabId: 1 }, "1.3"]]);
    // 2 sliders × (1 press + 8 moves + 1 release) = 20 CDP mouse events.
    expect(api.calls.send).toHaveLength(20);
    const types = api.calls.send.map((c) => c.params.type);
    expect(types.filter((t) => t === "mousePressed")).toHaveLength(2);
    expect(types.filter((t) => t === "mouseMoved")).toHaveLength(16);
    expect(types.filter((t) => t === "mouseReleased")).toHaveLength(2);
    // first drag presses at the current thumb X and releases at the target X.
    expect(api.calls.send[0].params).toMatchObject({
      type: "mousePressed",
      x: 469,
    });
    expect(api.calls.send[9].params).toMatchObject({
      type: "mouseReleased",
      x: 413,
    });
    expect(api.calls.detach).toEqual([{ tabId: 1 }]);
  });

  it("only drives the sliders that have values", async () => {
    const api = makeApi({ geo: [GEO[0]] });
    const r = await driveSunoSliders(1, { weirdness: 30 }, api);
    expect(r.set).toEqual(["weirdness"]);
    expect(api.scripting.executeScript.mock.calls[0][0].args[0]).toHaveLength(
      1,
    );
    expect(api.calls.send).toHaveLength(10); // one slider
  });

  it("detaches even when a CDP command throws mid-drag", async () => {
    const api = makeApi({ geo: GEO, sendThrows: true });
    const r = await driveSunoSliders(1, { weirdness: 20 }, api);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/drag failed/);
    expect(api.calls.detach).toEqual([{ tabId: 1 }]); // finally ran
  });

  it("reports attach failure (e.g. DevTools open) without dragging", async () => {
    const api = makeApi({ geo: GEO, attachThrows: true });
    const r = await driveSunoSliders(1, { weirdness: 20 }, api);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/attach/);
    expect(api.calls.send).toHaveLength(0);
  });

  it("reports when the sliders aren't on the page", async () => {
    const api = makeApi({ geo: [] });
    const r = await driveSunoSliders(1, { weirdness: 20 }, api);
    expect(r).toMatchObject({ ok: false, error: "sliders not found" });
    expect(api.debugger.attach).not.toHaveBeenCalled();
  });

  it("survives an executeScript failure", async () => {
    const api = makeApi({ execThrows: true });
    const r = await driveSunoSliders(1, { weirdness: 20 }, api);
    expect(r).toMatchObject({ ok: false, error: "slider lookup failed" });
  });
});

describe("sliderPasteMessage", () => {
  it("plain paste message when there are no slider values", () => {
    expect(sliderPasteMessage({ ok: true, set: [] }, {})).toBe(
      "Pasted into Suno. Hit Create.",
    );
  });

  it("confirms the sliders were set on success", () => {
    const msg = sliderPasteMessage(
      { ok: true, set: ["weirdness", "styleInfluence"] },
      { weirdness: 20, styleInfluence: 66 },
    );
    expect(msg).toMatch(/set the sliders/);
  });

  it("falls back to the exact numbers when driving failed", () => {
    const msg = sliderPasteMessage(
      { ok: false, set: [], error: "debugger attach failed" },
      { weirdness: 20, styleInfluence: 66 },
    );
    expect(msg).toContain("Weirdness 20");
    expect(msg).toContain("Style Influence 66");
    expect(msg).toMatch(/by hand/);
  });

  it("shows only the slider that had a value in the fallback", () => {
    const msg = sliderPasteMessage({ ok: false, set: [] }, { weirdness: 15 });
    expect(msg).toContain("Weirdness 15");
    expect(msg).not.toContain("Style Influence");
  });
});
