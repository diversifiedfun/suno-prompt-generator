# Build Spec — Suno Prompt Studio (Chrome Extension, MV3)

Implement the extension shell around two existing modules you MUST NOT modify:
`extension/knowledge.js` (vocab, tags, artist/vibe maps, contradictions) and
`extension/generator.js` (Claude API call + offline fallback). Import and use them.

Stack: Manifest V3, vanilla JS, ES modules, no bundler. Files live in `extension/`.
Visual style: adapt the synthwave dark aesthetic from `web-app/styles.css`.

## Files to create

1. **manifest.json** — MV3. permissions: `contextMenus`, `storage`, `sidePanel`.
   host_permissions: `https://api.anthropic.com/*`. background service_worker
   `background.js` with `"type": "module"`. `side_panel.default_path` = `sidepanel.html`.
   `action` with `default_title` (no icon files needed for v1 — omit the `icons` key and
   `default_icon` so it loads without image assets). name "Suno Prompt Studio".

2. **storage.js** (ES module) — `chrome.storage.local`, PER-KEY schema (`prompt_<id>`), not
   one array. Export async functions:
   - `addPrompt({text, title, tags, sourceUrl, source})` → generates `id` via
     `crypto.randomUUID()`, stamps `createdAt: Date.now()`, returns the record.
   - `getAllPrompts()` → array sorted newest-first.
   - `updatePrompt(id, patch)` (immutable merge), `deletePrompt(id)`.
   - `getSettings()` → `{ apiKey, model }` (defaults: apiKey '', model from generator
     DEFAULT_MODEL). `setSettings(patch)`.
   Use the callback→Promise wrapper pattern. Never log the apiKey.

3. **background.js** (service worker, module) —
   - On install: create context menu `{ id:'save-suno-prompt', title:'Save selection as Suno prompt', contexts:['selection'] }`.
   - `setPanelBehavior({ openPanelOnActionClick: true })`.
   - On menu click with `info.selectionText`: import `addPrompt` from storage.js, save
     `{ text: info.selectionText.trim(), sourceUrl: info.pageUrl, source:'captured', title:'', tags:[] }`,
     then `chrome.sidePanel.open({ windowId: tab.windowId })`. Wrap in try/catch.

4. **sidepanel.html** — shell with a top tab bar: **Library · Build · Generate · Settings**.
   `<script type="module" src="sidepanel.js">`. Link sidepanel.css.

5. **sidepanel.css** — adapt web-app/styles.css palette (magenta/cyan synthwave, dark),
   sized for a ~360–420px side panel (single column, compact).

6. **sidepanel.js** (ES module) — imports from `./knowledge.js`, `./generator.js`,
   `./storage.js`. Implements all four tabs (below).

7. **README.md** — "Load unpacked" install steps (chrome://extensions → Developer mode →
   Load unpacked → select the `extension/` folder), how to set the API key, the
   capture/build/generate workflow, and the shared-machine key warning.

## SECURITY (blocking requirements)

- **Never use `innerHTML` / `insertAdjacentHTML` with prompt text, page text, titles, tags,
  source URLs, or API output.** All dynamic content goes in via `textContent` or
  `document.createElement`. Saved prompts come from arbitrary web pages → treat as hostile.
- Render `sourceUrl` as a link with `rel="noopener noreferrer"`, and set `href` only if it
  starts with `http://`/`https://` (guard against `javascript:` URLs).
- API key: `type="password"` field; never written to console or the DOM as text.

## Tab behaviors

**Library** — list all saved prompts newest-first. Each card: title (or first ~80 chars of
text), the full text, tags, a source link if present, and buttons Copy / Edit / Delete
(Delete asks confirm). Edit lets you change title + comma tags. A search box filters by
text/title/tags (case-insensitive). Empty state explains right-click capture.

**Build** — the 4-component chip builder using knowledge.js (`GENRES`, `ERAS`, `MOODS`,
`INSTRUMENTS`, `VOCALS`). Genre+era selects; mood/instrument/vocal chips (multi-select).
Live style preview (genre first, comma-joined). Show descriptor count vs
`DESCRIPTOR_MIN`–`DESCRIPTOR_MAX` and char count vs `STYLE_SOFT_LIMIT` (warn, never block).
Run the contradiction guard (`CONTRADICTIONS`, WHOLE-WORD match via `\b` regex so
"female vocals" ≠ "male vocals") and an empty-word warning (`EMPTY_WORDS`). A lyrics
scaffold textarea with click-to-insert tag buttons (`STRUCTURE_TAGS` wrap `\n[Tag]\n`,
`VOICE_TAGS`/`DYNAMICS_TAGS` wrap `[Tag]`). "Save to library" stores the built style prompt
(source:'built'). Copy buttons for style + lyrics.

**Generate** — a textarea + a mode toggle (Vibe ↔ Artist) + model is taken from Settings.
On submit call `generatePrompt({ mode, input, apiKey, model })` from generator.js
(it's async and never throws for offline). Render: **style** (big, copyable), **exclude**,
**bpm**, **structure** (pre/textarea, copyable), **notes** (as a tip), and **variants**
(each copyable). Each result section has Copy and a "Save to library" (source:'generated').
Show a loading state while awaiting. If `result.fallback` is true, show the notes prominently
(it explains the offline/api situation). For Artist mode, add a one-line reminder that the
output is descriptors, not the artist's name (per Suno policy).

**Settings** — API key password field + model `<select>` (use `MODELS` from generator.js) +
Save. A privacy note: "Your key is stored locally in this browser only and sent only to
Anthropic. Don't use on shared computers." A "test key" button is optional.

## Conventions
kebab-case files, const/let, async/await, functions ≤40 lines, immutable updates, handle
errors (no silent swallow), comments explain WHY. Keep modules focused.
