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

## Getting an Anthropic API key

The AI features (the **✨ Vibe** tab and the **🎧 Set** builder) call Anthropic's Claude, so
this is a **bring-your-own-key** tool. Your key is stored only in your browser and sent only to
Anthropic — never to us, and never logged. (**🎛 Build** and **📚 Library** work with no key at all.)

It takes about two minutes:

1. **Open the Anthropic Console** → **[platform.claude.com](https://platform.claude.com)**
   (the older `console.anthropic.com` also redirects here). Sign up or log in with Google or email.
2. **Add credits.** The API is pay-as-you-go, so open **Billing** and add a payment method or buy
   prepaid credits. Usage is cheap — generating a full set runs roughly a few cents. (New accounts
   sometimes include a small free trial credit.)
3. **Create the key** → go to **[platform.claude.com/settings/keys](https://platform.claude.com/settings/keys)**
   → **Create Key** → name it something like `Suno Prompt Studio`.
4. **Copy it.** The key starts with `sk-ant-` and is shown **only once** — copy it somewhere safe.
5. **Paste it into the extension:** **⚙ Settings** → **Anthropic API key** → pick a model → **Save**.

That's it — the **✨ Vibe** and **🎧 Set** tabs now generate for real.

> **New to the API?** Anthropic's own quickstart walks through account setup and your first call:
> **[Get started with the Claude API](https://platform.claude.com/docs/en/get-started)**.

## The method in one line

`[Genre + Era], [Mood], [Instruments], [Vocals]` — 6–12 descriptors, genre first, anchor a
BPM, 3-layer vocal spec, scenes over emotion-words, artists → descriptors (never the name),
negatives in Suno's Exclude field. Full reasoning in `docs/suno-prompt-learnings.md`.

## How it was built

Research fan-out (3 parallel agents: official mechanics · community techniques · MV3
architecture) → committed learnings catalog → builder agent for the extension shell →
security + reviewer audit gates → fixes → verification. The "intelligence" modules
(`extension/knowledge.js`, `extension/generator.js`) encode the catalog directly.
