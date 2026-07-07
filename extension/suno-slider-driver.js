// suno-slider-driver.js — sets Suno's Weirdness / Style Influence sliders on paste.
//
// Suno renders these as custom `<div role="slider">` widgets whose value is
// committed ONLY on a TRUSTED user gesture. A content script's synthetic events
// (keyboard, pointer, even calling the React onChange) are all ignored — verified
// against the live DOM 2026-07-06. The only way to move them from the extension
// is a REAL trusted mouse drag, which we dispatch via the chrome.debugger (CDP
// Input.dispatchMouseEvent) API. That is why the extension needs the "debugger"
// permission and Chrome shows a "debugging this browser" banner during a paste.
//
// Coordinates: CDP mouse events use CSS pixels relative to the main-frame
// viewport, which is exactly what getBoundingClientRect() returns — so page
// geometry maps straight to CDP coords with no conversion.
//
// Because even the trusted drag could silently miss (widget quirks, coordinate
// drift), we do NOT trust the drag blindly: after dragging we RE-READ each
// slider's aria-valuenow and only report a slider as "set" if it actually landed
// near the target. Anything that didn't land falls back to the "set by hand"
// message — so the UI never lies about what happened.

// aria-label keyword → value key on the track/result object → human label.
export const SLIDER_TARGETS = [
  { keyword: "weird", key: "weirdness", label: "Weirdness" },
  { keyword: "influence", key: "styleInfluence", label: "Style Influence" },
];

// How close aria-valuenow must land to the target to count as "set" (Suno's
// track has ~1-unit granularity; a couple units of drift is still "on target").
const LAND_TOLERANCE = 3;

// Pure geometry: the viewport X for a given slider value. Exported so the math is
// unit-tested. NOTE: collectSliderGeometry (which runs in-page via executeScript,
// where it can't import this) inlines the same formula — keep them in sync.
export function sliderValueX(rect, min, max, value) {
  const span = max - min || 1;
  const clamped = Math.max(min, Math.min(max, value));
  return rect.left + ((clamped - min) / span) * rect.width;
}

// Injected into the page (executeScript). Scrolls the sliders' region into view
// once (they can sit below the fold / in a collapsed panel), then returns the
// trusted-drag geometry for each requested slider: drag from the current thumb X
// to the target X, along the track's vertical center. Self-contained — no closure.
function collectSliderGeometry(targets) {
  const all = Array.from(document.querySelectorAll('[role="slider"]'));
  const find = (kw) =>
    all.find((x) =>
      (x.getAttribute("aria-label") || "").toLowerCase().includes(kw),
    );
  const anchor = targets.map((t) => find(t.keyword)).find(Boolean);
  if (anchor) anchor.scrollIntoView({ block: "center", inline: "nearest" });

  const out = [];
  for (const t of targets) {
    const el = find(t.keyword);
    if (!el) continue;
    const b = el.getBoundingClientRect();
    if (!b.width) continue;
    const min = Number(el.getAttribute("aria-valuemin") || 0);
    const max = Number(el.getAttribute("aria-valuemax") || 100);
    const now = Number(el.getAttribute("aria-valuenow"));
    const span = max - min || 1;
    const xFor = (v) =>
      b.left + ((Math.max(min, Math.min(max, v)) - min) / span) * b.width;
    out.push({
      key: t.key,
      keyword: t.keyword,
      pct: Number(t.pct),
      y: b.top + b.height / 2,
      startX: xFor(Number.isFinite(now) ? now : min),
      endX: xFor(Number(t.pct)),
    });
  }
  return out;
}

// Injected into the page (executeScript). Re-reads current aria-valuenow for each
// keyword so we can confirm the drag actually landed. Self-contained — no closure.
function readSliderValues(keywords) {
  const all = Array.from(document.querySelectorAll('[role="slider"]'));
  const out = {};
  for (const kw of keywords) {
    const el = all.find((x) =>
      (x.getAttribute("aria-label") || "").toLowerCase().includes(kw),
    );
    out[kw] = el ? Number(el.getAttribute("aria-valuenow")) : null;
  }
  return out;
}

// Dispatch one trusted click-drag along a slider track via CDP.
async function dragSlider(api, target, g) {
  const send = (params) =>
    api.debugger.sendCommand(target, "Input.dispatchMouseEvent", params);
  await send({
    type: "mousePressed",
    x: g.startX,
    y: g.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    const x = g.startX + ((g.endX - g.startX) * i) / steps;
    await send({ type: "mouseMoved", x, y: g.y, button: "left", buttons: 1 });
  }
  // buttons:0 on release = the button state AFTER the transition (widgets that
  // finalize a gesture on `e.buttons === 0` need this to commit).
  await send({
    type: "mouseReleased",
    x: g.endX,
    y: g.y,
    button: "left",
    buttons: 0,
    clickCount: 1,
  });
}

// Only one debugger-driven paste at a time. A double-click or back-to-back paste
// would otherwise call chrome.debugger.attach() twice on the same tab (the second
// throws "Another debugger is already attached"). Module-scoped, so it guards all
// paste paths that import this module in the same side-panel context.
let driving = false;

// Set the Weirdness / Style Influence sliders on `tabId` to the given values.
// `values` = { weirdness, styleInfluence } (0–100; blank/absent/non-numeric =
// leave that slider alone). `api` defaults to `chrome` (injected in tests).
// NEVER throws. Returns { ok, requested:[keys], set:[keys that VERIFIABLY landed],
// error? } — `set` reflects re-read aria-valuenow, not just "the drag didn't throw".
export async function driveSunoSliders(tabId, values, api = chrome) {
  const vals = values || {};
  const targets = SLIDER_TARGETS.map((t) => ({
    ...t,
    pct: vals[t.key],
  })).filter(
    (t) =>
      t.pct != null &&
      String(t.pct).trim() !== "" &&
      Number.isFinite(Number(t.pct)),
  );
  const requested = targets.map((t) => t.key);
  // Nothing to set (e.g. DJ-set tracks keep Suno's default 50%) — no debugger,
  // no banner.
  if (!targets.length) return { ok: true, requested: [], set: [] };
  if (driving)
    return {
      ok: false,
      requested,
      set: [],
      error: "a slider paste is already running",
    };

  driving = true;
  try {
    let geo;
    try {
      const [res] = await api.scripting.executeScript({
        target: { tabId },
        func: collectSliderGeometry,
        args: [
          targets.map((t) => ({ keyword: t.keyword, key: t.key, pct: t.pct })),
        ],
      });
      geo = res && res.result;
    } catch {
      return { ok: false, requested, set: [], error: "slider lookup failed" };
    }
    if (!geo || !geo.length)
      return { ok: false, requested, set: [], error: "sliders not found" };

    const target = { tabId };
    try {
      await api.debugger.attach(target, "1.3");
    } catch {
      return {
        ok: false,
        requested,
        set: [],
        error: "debugger attach failed (DevTools open on the tab?)",
      };
    }
    try {
      for (const g of geo) await dragSlider(api, target, g);
    } catch {
      return { ok: false, requested, set: [], error: "slider drag failed" };
    } finally {
      // Always detach so the "debugging this browser" banner clears.
      try {
        await api.debugger.detach(target);
      } catch {
        /* already detached / tab gone */
      }
    }

    // Verify: re-read aria-valuenow and only claim the sliders that actually
    // landed near their target. Anything that didn't → "set by hand" fallback.
    let landed = [];
    try {
      const [res] = await api.scripting.executeScript({
        target: { tabId },
        func: readSliderValues,
        args: [geo.map((g) => g.keyword)],
      });
      const actual = (res && res.result) || {};
      landed = geo
        .filter((g) => {
          const v = actual[g.keyword];
          return v != null && Math.abs(v - g.pct) <= LAND_TOLERANCE;
        })
        .map((g) => g.key);
    } catch {
      landed = []; // couldn't verify → treat as unconfirmed, show numbers
    }
    return { ok: landed.length > 0, requested, set: landed };
  } finally {
    driving = false;
  }
}

// Build the paste status line from a driveSunoSliders result. Claims success only
// for sliders that VERIFIABLY landed; any requested-but-unconfirmed slider falls
// back to showing its exact number so the user sets it by hand.
export function sliderPasteMessage(result, values = {}) {
  const requested = (result && result.requested) || [];
  const set = new Set((result && result.set) || []);
  if (!requested.length) return "Pasted into Suno. Hit Create.";

  const missing = SLIDER_TARGETS.filter(
    (t) => requested.includes(t.key) && !set.has(t.key),
  );
  if (!missing.length) return "Pasted into Suno + set the sliders. Hit Create.";

  const parts = missing.map((t) => `${t.label} ${values[t.key]}`);
  return `Pasted into Suno — set ${parts.join(" / ")} by hand, then Create.`;
}
