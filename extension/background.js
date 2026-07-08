// background.js — MV3 service worker.
// Owns context-menu registration and side-panel open-on-action behavior.
// Imported as a module so we can use ES import for storage.js.
import { addPrompt } from "./storage.js";

// Open the side panel when the toolbar button is clicked. Set at module top level
// (idempotent) so it survives SW restarts — onInstalled only fires on install/update.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) =>
    console.error("[Suno Prompt Studio] setPanelBehavior:", err.message),
  );

// --- Install -----------------------------------------------------------------
// Register the context menu on install/update. onInstalled fires again on every
// unpacked-extension RELOAD, and the previous item can still exist — calling
// create() with the same id then throws "Cannot create item with duplicate id",
// which flags the whole extension as errored. removeAll() first makes this
// idempotent and error-free across reloads.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    // Read lastError so removeAll's callback doesn't surface an unchecked warning.
    void chrome.runtime.lastError;
    chrome.contextMenus.create({
      id: "save-suno-prompt",
      title: "Save selection as Suno prompt",
      contexts: ["selection"],
    });
  });
});

// --- Context-menu handler ---------------------------------------------------
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-suno-prompt") return;
  const text = (info.selectionText || "").trim();
  if (!text) return;

  try {
    await addPrompt({
      text,
      sourceUrl: info.pageUrl || "",
      source: "captured",
      title: "",
      tags: [],
    });
    // Open the side panel so the user sees their new capture immediately.
    await chrome.sidePanel.open({ windowId: tab.windowId });
  } catch (err) {
    // Log but never swallow — visible in background SW console.
    console.error("[Suno Prompt Studio] Failed to save prompt:", err.message);
  }
});
