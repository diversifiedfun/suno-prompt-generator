// chrome-shim.js — DEV ONLY. Lets the real side-panel UI run in a normal browser
// tab (not an installed extension) by emulating the chrome.* APIs it uses.
// chrome.storage.local is backed by localStorage; the rest are no-ops.
// This file is NOT referenced by manifest.json and never ships in the extension.
(function () {
  const KEY = "sps_dev_store";
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || "{}");
    } catch {
      return {};
    }
  };
  const write = (obj) => localStorage.setItem(KEY, JSON.stringify(obj));

  const local = {
    get(keys, cb) {
      const store = read();
      let result = {};
      if (keys === null || keys === undefined) {
        result = { ...store };
      } else if (typeof keys === "string") {
        if (keys in store) result[keys] = store[keys];
      } else if (Array.isArray(keys)) {
        keys.forEach((k) => {
          if (k in store) result[k] = store[k];
        });
      }
      cb(result);
    },
    set(items, cb) {
      write({ ...read(), ...items });
      cb && cb();
    },
    remove(keys, cb) {
      const store = read();
      (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete store[k]);
      write(store);
      cb && cb();
    },
  };

  const noopListener = { addListener() {} };
  globalThis.chrome = {
    storage: { local },
    runtime: { lastError: undefined, onInstalled: noopListener },
    contextMenus: { create() {}, onClicked: noopListener },
    sidePanel: {
      setPanelBehavior: () => Promise.resolve(),
      open: () => Promise.resolve(),
    },
  };
  console.log("[dev-shim] chrome.* emulated; storage → localStorage");
})();
