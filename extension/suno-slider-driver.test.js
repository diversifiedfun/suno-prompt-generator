import { describe, it, expect, vi } from "vitest";
import {
  driveSunoSliders,
  sliderPasteMessage,
  sliderValueX,
} from "./suno-slider-driver.js";

// A fake chrome API. executeScript resolves geometry on the first (collect) call
// and re-read values on the second (verify) call, distinguished by the injected
// function's name. debugger methods are spies so we can assert the CDP sequence.
function makeApi({
  geo,
  verify,
  attachThrows,
  sendThrows,
  execThrows,
  verifyThrows,
} = {}) {
  const calls = { send: [], attach: [], detach: [], exec: [] };
  return {
    calls,
    scripting: {
      executeScript: vi.fn(async (opts) => {
        calls.exec.push(opts);
        const isVerify = opts.func && opts.func.name === "readSliderValues";
        if (isVerify) {
          if (verifyThrows) throw new Error("verify boom");
          return [{ result: verify || {} }];
        }
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
  {
    key: "weirdness",
    keyword: "weird",
    pct: 20,
    y: 391,
    startX: 469,
    endX: 413,
  },
  {
    key: "styleInfluence",
    keyword: "influence",
    pct: 66,
    y: 391,
    startX: 469,
    endX: 496,
  },
];
const VERIFY_BOTH = { weird: 20, influence: 66 };

describe("driveSunoSliders", () => {
  it("no-ops (no debugger, no banner) when no slider values are given", async () => {
    const api = makeApi({ geo: GEO, verify: VERIFY_BOTH });
    const r = await driveSunoSliders(1, {}, api);
    expect(r).toEqual({ ok: true, requested: [], set: [] });
    expect(api.scripting.executeScript).not.toHaveBeenCalled();
    expect(api.debugger.attach).not.toHaveBeenCalled();
  });

  it("does not throw when values is null (contract: never throws)", async () => {
    const api = makeApi({ geo: GEO, verify: VERIFY_BOTH });
    const r = await driveSunoSliders(1, null, api);
    expect(r).toEqual({ ok: true, requested: [], set: [] });
  });

  it("filters out blank / non-numeric values before touching the tab", async () => {
    const api = makeApi({ geo: GEO, verify: VERIFY_BOTH });
    const r = await driveSunoSliders(
      1,
      { weirdness: "", styleInfluence: "abc" },
      api,
    );
    expect(r).toEqual({ ok: true, requested: [], set: [] });
    expect(api.debugger.attach).not.toHaveBeenCalled();
  });

  it("drags each slider, verifies the landed value, and detaches", async () => {
    const api = makeApi({ geo: GEO, verify: VERIFY_BOTH });
    const r = await driveSunoSliders(
      1,
      { weirdness: 20, styleInfluence: 66 },
      api,
    );
    expect(r).toEqual({
      ok: true,
      requested: ["weirdness", "styleInfluence"],
      set: ["weirdness", "styleInfluence"],
    });
    expect(api.calls.attach).toEqual([[{ tabId: 1 }, "1.3"]]);
    // 2 sliders × (1 press + 8 moves + 1 release) = 20 CDP mouse events.
    const types = api.calls.send.map((c) => c.params.type);
    expect(types.filter((t) => t === "mousePressed")).toHaveLength(2);
    expect(types.filter((t) => t === "mouseMoved")).toHaveLength(16);
    expect(types.filter((t) => t === "mouseReleased")).toHaveLength(2);
    // press holds the button; release reports buttons:0 (post-transition state).
    expect(api.calls.send[0].params).toMatchObject({
      type: "mousePressed",
      x: 469,
      buttons: 1,
    });
    expect(api.calls.send[9].params).toMatchObject({
      type: "mouseReleased",
      x: 413,
      buttons: 0,
    });
    expect(api.calls.detach).toEqual([{ tabId: 1 }]);
    // two executeScript calls: collect geometry, then verify
    expect(api.calls.exec).toHaveLength(2);
  });

  it("reports ONLY the sliders that verifiably landed (honest success)", async () => {
    // style influence did NOT move (still 50), weirdness landed
    const api = makeApi({ geo: GEO, verify: { weird: 20, influence: 50 } });
    const r = await driveSunoSliders(
      1,
      { weirdness: 20, styleInfluence: 66 },
      api,
    );
    expect(r.requested).toEqual(["weirdness", "styleInfluence"]);
    expect(r.set).toEqual(["weirdness"]);
    expect(r.ok).toBe(true); // at least one landed
  });

  it("treats an unverifiable drag as unconfirmed (shows numbers, not fake success)", async () => {
    const api = makeApi({ geo: GEO, verify: VERIFY_BOTH, verifyThrows: true });
    const r = await driveSunoSliders(1, { weirdness: 20 }, api);
    expect(r.set).toEqual([]);
    expect(r.ok).toBe(false);
    expect(api.calls.detach).toEqual([{ tabId: 1 }]); // still detached
  });

  it("only drives the sliders that have values", async () => {
    const api = makeApi({
      geo: [{ ...GEO[0], pct: 30 }],
      verify: { weird: 30 },
    });
    const r = await driveSunoSliders(1, { weirdness: 30 }, api);
    expect(r.requested).toEqual(["weirdness"]);
    expect(r.set).toEqual(["weirdness"]);
    expect(api.calls.send).toHaveLength(10); // one slider
  });

  it("detaches even when a CDP command throws mid-drag", async () => {
    const api = makeApi({ geo: GEO, sendThrows: true });
    const r = await driveSunoSliders(1, { weirdness: 20 }, api);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/drag failed/);
    expect(api.calls.detach).toEqual([{ tabId: 1 }]);
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

  it("guards against a concurrent run on the same tab (double-attach)", async () => {
    const api = makeApi({ geo: GEO, verify: VERIFY_BOTH });
    const [a, b] = await Promise.all([
      driveSunoSliders(1, { weirdness: 20 }, api),
      driveSunoSliders(1, { weirdness: 20 }, api),
    ]);
    const errs = [a, b].filter(
      (r) => r.error === "a slider paste is already running",
    );
    expect(errs).toHaveLength(1);
    expect(api.calls.attach).toHaveLength(1); // only the first attached
  });
});

describe("sliderValueX (geometry math)", () => {
  const rect = { left: 377, width: 200 };
  it("maps min / mid / max to the track ends", () => {
    expect(sliderValueX(rect, 0, 100, 0)).toBe(377);
    expect(sliderValueX(rect, 0, 100, 50)).toBe(477);
    expect(sliderValueX(rect, 0, 100, 100)).toBe(577);
  });
  it("clamps out-of-range values to the track", () => {
    expect(sliderValueX(rect, 0, 100, -20)).toBe(377);
    expect(sliderValueX(rect, 0, 100, 150)).toBe(577);
  });
  it("does not divide by zero on a degenerate range", () => {
    expect(sliderValueX(rect, 50, 50, 50)).toBe(377);
  });
});

describe("sliderPasteMessage", () => {
  it("plain paste message when there are no slider values", () => {
    expect(sliderPasteMessage({ ok: true, requested: [], set: [] }, {})).toBe(
      "Pasted into Suno. Hit Create.",
    );
  });

  it("confirms success only when every requested slider landed", () => {
    const msg = sliderPasteMessage(
      {
        ok: true,
        requested: ["weirdness", "styleInfluence"],
        set: ["weirdness", "styleInfluence"],
      },
      { weirdness: 20, styleInfluence: 66 },
    );
    expect(msg).toMatch(/set the sliders/);
  });

  it("names ONLY the unlanded slider on a partial result", () => {
    const msg = sliderPasteMessage(
      {
        ok: true,
        requested: ["weirdness", "styleInfluence"],
        set: ["weirdness"],
      },
      { weirdness: 20, styleInfluence: 66 },
    );
    expect(msg).toContain("Style Influence 66");
    expect(msg).not.toContain("Weirdness 20"); // that one landed
    expect(msg).toMatch(/by hand/);
  });

  it("falls back to both numbers when nothing landed", () => {
    const msg = sliderPasteMessage(
      { ok: false, requested: ["weirdness", "styleInfluence"], set: [] },
      { weirdness: 20, styleInfluence: 66 },
    );
    expect(msg).toContain("Weirdness 20");
    expect(msg).toContain("Style Influence 66");
  });
});
