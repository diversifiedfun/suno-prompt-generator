# Suno Prompt Studio

A zero-build prompt generator for [Suno](https://suno.com) AI music. Encodes the
methodology from the [Musci.io Suno guide](https://musci.io/blog/suno-prompts) so
you build prompts that actually land instead of burning credits on regenerations.

## Open it

Double-click `index.html`. No server, no install, fully offline. Works in any
modern browser. State auto-saves to your browser.

## What it does

**Style Prompt Builder** — the 4-component structure (Genre+Era · Mood ·
Instruments · Vocals) as clickable chips. Live preview with:
- **Descriptor counter** — green inside the 4–7 sweet spot, red outside it
- **Char counter** — warns as you approach Suno's ~200-char style limit
- **Contradiction guard** — flags conflicting terms ("calm aggressive", "no
  vocals + female vocals") that confuse the model
- **Sandwich method** toggle — repeats the genre first + last for weighting
- **Negative prompt** chips — tell Suno what to avoid
- **🎲 Surprise me** — random prompt that respects the sweet spot

**Lyrics & Structure** — composes the *separate* lyrics field. Click structure
tags (`[Verse]`, `[Chorus]`…), voice tags (`[Belting]`, `[Whispered vocals]`…),
and dynamics tags to insert at the cursor.

**Preset Library** — 111 tested examples across 11 genre families. Filter,
search, click to load.

## Files

| File | What |
|------|------|
| `index.html` | markup |
| `styles.css` | synthwave studio styling |
| `data.js` | vocabularies + the 111 presets (read-only reference data) |
| `app.js` | builder logic, contradiction guard, preset loading |

Classic scripts (not ES modules) so it opens via `file://` with no CORS issues.

## The method in one line

`[Genre + Era], [Mood], [Instruments], [Vocals]` — 4–7 descriptors, vocals first,
era anchors, lyrics + metatags in the separate field. Expect 3–6 regenerations
per track.
