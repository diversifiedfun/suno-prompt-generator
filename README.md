# Suno Prompt Studio

Tools for writing Suno AI prompts that actually produce great songs — built on a
research catalog of official Suno mechanics + community-proven techniques.

## What's here

| Folder | What |
|--------|------|
| **`extension/`** | The main deliverable — a Chrome (MV3) side-panel extension. Capture prompts you like from any page, build new ones with guided chips, and AI-generate a dialed-in prompt from a vibe or an artist (translated to descriptors). See `extension/README.md` to install. |
| **`web-app/`** | The original zero-build standalone tool (`index.html`). No extension, no AI — just the component builder + 111-preset library. Double-click to open. |
| **`docs/`** | `suno-prompt-learnings.md` — the master catalog of everything we learned (official + community, with confidence levels + sources). `extension-spec.md` — the build spec. |

**New here / not a coder?** Read the plain-English **[User Guide](docs/USER-GUIDE.md)** — it covers
install, setup, and every tab step by step.

## Quick start (extension)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select `extension/`.
2. Click the toolbar icon → **⚙ Settings** → paste your Anthropic API key (stored locally only).
3. **✨ Vibe** tab: describe a vibe ("heartbreak in an empty apartment") or an artist
   ("sound like Phoebe Bridgers") → get a Suno-ready style prompt, Exclude list, BPM, and a
   `[Verse]/[Chorus]` scaffold.
4. **🎧 Set** tab: pick an occasion → set length → (optional) a lyrics theme → **Build my set** for a
   whole multi-track playlist with an energy arc, then **Paste next → Suno** one track at a time.
5. Right-click any selected text on a page → **Save selection as Suno prompt** to capture into 📚 Library.

Tabs: **✨ Vibe · 🎛 Build · 🎧 Set · 📚 Library · ⚙ Settings**.

## The method in one line

`[Genre + Era], [Mood], [Instruments], [Vocals]` — 6–12 descriptors, genre first, anchor a
BPM, 3-layer vocal spec, scenes over emotion-words, artists → descriptors (never the name),
negatives in Suno's Exclude field. Full reasoning in `docs/suno-prompt-learnings.md`.

## How it was built

Research fan-out (3 parallel agents: official mechanics · community techniques · MV3
architecture) → committed learnings catalog → builder agent for the extension shell →
security + reviewer audit gates → fixes → verification. The "intelligence" modules
(`extension/knowledge.js`, `extension/generator.js`) encode the catalog directly.
