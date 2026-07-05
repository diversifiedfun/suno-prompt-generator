// Minimal in-memory chrome.storage.local for vitest. Callback-style to match the real API.
export function installChromeMock() {
  const store = new Map();
  globalThis.chrome = {
    runtime: { lastError: null },
    storage: {
      local: {
        get(keys, cb) {
          const out = {};
          if (keys === null || keys === undefined) {
            for (const [k, v] of store) out[k] = v;
          } else {
            for (const k of [].concat(keys))
              if (store.has(k)) out[k] = store.get(k);
          }
          cb(out);
        },
        set(items, cb) {
          for (const [k, v] of Object.entries(items)) store.set(k, v);
          cb();
        },
        remove(keys, cb) {
          for (const k of [].concat(keys)) store.delete(k);
          cb();
        },
      },
    },
  };
  return store;
}
