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
// Coordinates: CDP mouse events use CSS pixels relative to the viewport top-left,
// which is exactly what getBoundingClientRect() returns — so page geometry maps
// straight to CDP coords with no conversion.

// aria-label keyword → the value key on the generated track/result object.
export const SLIDER_TARGETS = [
  { keyword: "weird", key: "weirdness" },
  { keyword: "influence", key: "styleInfluence" },
];

// Injected into the page (executeScript). For each requested slider, returns the
// trusted-drag geometry: drag from the current thumb X to the target X, along the
// track's vertical center. Self-contained — runs with no outer closure.
function collectSliderGeometry(targets) {
  const all = Array.from(document.querySelectorAll('[role="slider"]'));
  const find = (kw) =>
    all.find((x) =>
      (x.getAttribute("aria-label") || "").toLowerCase().includes(kw),
    );
  // Scroll the sliders' region into view ONCE (they can sit below the fold or in
  // a collapsed panel), then measure every target against that stable layout — so
  // the coords the CDP drag uses a moment later are still valid.
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
    const clamp = (v) => Math.max(min, Math.min(max, v));
    const xFor = (v) => b.left + ((clamp(v) - min) / (max - min)) * b.width;
    out.push({
      key: t.key,
      y: b.top + b.height / 2,
      startX: xFor(Number.isFinite(now) ? now : min),
      endX: xFor(Number(t.pct)),
    });
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
  await send({
    type: "mouseReleased",
    x: g.endX,
    y: g.y,
    button: "left",
    buttons: 1,
    clickCount: 1,
  });
}

// Set the Weirdness / Style Influence sliders on `tabId` to the given values.
// `values` = { weirdness, styleInfluence } (0–100; blank/absent/non-numeric =
// leave that slider alone). `api` defaults to `chrome` (injected in tests).
// NEVER throws — returns { ok, set:[keys], error? } so a failure downgrades the
// paste status instead of breaking the (already-completed) text paste.
export async function driveSunoSliders(tabId, values = {}, api = chrome) {
  const targets = SLIDER_TARGETS.map((t) => ({
    ...t,
    pct: values[t.key],
  })).filter(
    (t) =>
      t.pct != null &&
      String(t.pct).trim() !== "" &&
      Number.isFinite(Number(t.pct)),
  );
  // Nothing to set (e.g. DJ-set tracks keep Suno's default 50%) — no debugger,
  // no banner.
  if (!targets.length) return { ok: true, set: [] };

  let geo;
  try {
    const [res] = await api.scripting.executeScript({
      target: { tabId },
      func: collectSliderGeometry,
      args: [targets],
    });
    geo = res && res.result;
  } catch {
    return { ok: false, set: [], error: "slider lookup failed" };
  }
  if (!geo || !geo.length)
    return { ok: false, set: [], error: "sliders not found" };

  const target = { tabId };
  try {
    await api.debugger.attach(target, "1.3");
  } catch {
    return {
      ok: false,
      set: [],
      error: "debugger attach failed (DevTools open on the tab?)",
    };
  }
  try {
    for (const g of geo) await dragSlider(api, target, g);
  } catch {
    return { ok: false, set: [], error: "slider drag failed" };
  } finally {
    // Always detach so the "debugging this browser" banner clears.
    try {
      await api.debugger.detach(target);
    } catch {
      /* already detached / tab gone */
    }
  }
  return { ok: true, set: geo.map((g) => g.key) };
}

// Build the paste status line. On success says the sliders were set; on failure
// (or when the widget can't be driven) falls back to showing the exact numbers
// so the user sets them by hand.
export function sliderPasteMessage(result, values = {}) {
  const present = (v) => v != null && String(v).trim() !== "";
  const w = values.weirdness;
  const si = values.styleInfluence;
  if (!present(w) && !present(si)) return "Pasted into Suno. Hit Create.";
  if (result && result.ok && result.set && result.set.length) {
    return "Pasted into Suno + set the sliders. Hit Create.";
  }
  const parts = [];
  if (present(w)) parts.push(`Weirdness ${w}`);
  if (present(si)) parts.push(`Style Influence ${si}`);
  return `Pasted into Suno — set ${parts.join(" / ")} by hand, then Create.`;
}
