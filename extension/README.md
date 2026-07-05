# Suno Prompt Studio — Chrome Extension

A Manifest V3 side-panel extension for building, capturing, and AI-generating Suno music prompts.

## Install (Load Unpacked)

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (toggle, top-right).
3. Click **Load unpacked**.
4. Select the `extension/` folder from this repo.
5. The extension icon appears in your toolbar. Click it to open the side panel.

## Set Your API Key

1. Open the side panel → **Settings** tab.
2. Paste your Anthropic API key (`sk-ant-…`) into the password field.
3. Choose a model (Sonnet 4.6 recommended; Haiku 4.5 is faster and cheaper).
4. Click **Save settings**.

Your key is stored in `chrome.storage.local` — local to this browser profile only. It is sent exclusively to `https://api.anthropic.com`. If no key is set, Generate falls back to the curated offline library.

**Do not use on shared computers.** Anyone with access to Chrome DevTools on this profile can read `chrome.storage.local`.

## Workflow

### Capture from any page
1. Select text on any web page (a prompt, lyrics, style description).
2. Right-click → **Save selection as Suno prompt**.
3. The side panel opens and the prompt appears in **Library**.

### Build tab
1. Choose genre + era from the dropdowns.
2. Select mood, instrument, and vocal chips (multi-select).
3. The live style preview updates with descriptor count and character count warnings.
4. Contradiction and empty-word guards flag issues before you save.
5. Use the tag buttons to insert `[Verse]`, `[Chorus]`, etc. into the lyrics scaffold.
6. **Save to Library** or **Copy style** to paste directly into Suno.

> **Tab order:** ✨ Vibe · 🎛 Build · 🎧 Set · | 📚 Library · ⚙ Settings. The "Vibe" tab is the
> AI single-song generator (formerly "Generate"). **A friendly, non-technical walkthrough of every
> tab lives in [`../docs/USER-GUIDE.md`](../docs/USER-GUIDE.md).**

### Vibe tab (AI single-song generator)
1. Type a vibe description or artist reference.
2. Toggle **Vibe** (feeling/scene) or **Artist** (decomposed into descriptors — never the name, per Suno policy).
3. Click **Generate**. Results show style, exclude, BPM, structure scaffold, a tip, and variants.
4. Copy or **Save to Library** any result section.

### Set tab (guided multi-track set builder)
A progressive, guided flow — no music jargon required:
1. **Occasion cards** — pick one (Move: day party / night drive / grind / workout / focus / feel-good;
   Calm-Focus: deep focus / meditation / sleep / wind-down / ambient / sound bath / yoga). Each maps to
   a research-backed preset.
2. **How long?** — runtime (30 min / 1 h / 2 h / custom) × track length (Standard / Extended / **DJ-Long**,
   which trades track count for runtime at the same credit cost). A **live credit estimate** updates as
   you dial (`≈ N tracks ≈ ~X credits`, ~10 credits/track).
3. **Mad-libs sentence** — tappable, pre-filled blanks describe the *sound* (chips from `VIBES`).
4. **✍️ Lyrics theme** (optional) — pick/type a theme; on an instrumental occasion it **forces lyrics**
   on that theme (with a focus-preset heads-up). Blank = instrumental.
5. **▸ Fine-tune** — override genre, exact track count, or preset sub-choices (e.g. Sleep major/minor).
6. **Build my set** → the **arc gate**: energy graph + per-track briefs. **▲/▼ nudge** a track's energy
   (BPM + contour update live), edit the **🔁 recurring motif** (bookends the opener + closer), reorder
   with ↑/↓, or **Refine** in words ("track 5 deeper", "kill the vocals").
7. **Generate all tracks** → each gets full Style/Exclude/BPM/lyrics.
8. Open a `suno.com` tab → **Paste next → Suno** steps the set in one track at a time (it fills the
   fields; you click Create). A **resume tracker** (✓/●/○ + progress bar) persists, so you can stop and
   come back and see exactly where you left off. Or **Copy whole set**.

**📁 My sets** (top of the Set tab) lists every set — reopen (restores the right stage), rename, delete.
Sets auto-save under `set_*` keys, separate from captured prompts. Wellness presets render sounds
(e.g. "528Hz-tuned drone") but never make medical claims — enforced in code, even when lyrics are forced.

### Library tab
- All saved prompts, newest first.
- Search box filters by text, title, and tags (case-insensitive).
- Each card: **Copy**, **Edit** (title + tags), **Delete** (with confirm).
- Source links open in a new tab (http/https only).

## Security Notes

- Prompt text from arbitrary web pages is never rendered via `innerHTML` — XSS into a privileged side panel is explicitly prevented.
- The API key is a password field and is never written to the console or the DOM as text.
- Source URLs are validated to `http://` or `https://` before being rendered as links.
