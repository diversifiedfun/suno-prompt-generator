# Suno Prompt Studio — User Guide

A friendly, plain-English guide to the Chrome extension that helps you write great
[Suno](https://suno.com) music prompts — one song at a time, or a whole DJ-style set with an
energy arc. No coding needed.

---

## 1. What this is (in one minute)

Suno makes music from a text description. Getting a *good* song out of it is a craft — the right
genre words, a tempo, what to leave out. This extension does that craft for you. It lives in a panel
on the side of your Chrome window and has three ways to make music plus a place to keep what you like:

| Tab | What it's for | Reach for it when… |
|-----|---------------|--------------------|
| **✨ Vibe** | Describe a feeling → get one finished prompt | "I want *one* song that feels like a rainy drive." |
| **🎛 Build** | Hand-pick every ingredient of one song | You know exactly the genre/mood/instruments you want. |
| **🎧 Set** | A whole multi-track playlist with an energy arc | A workout mix, a sleep set, a 2-hour day-party. |
| **📚 Library** | Everything you've saved | Finding a prompt you made before. |
| **⚙ (gear)** | Settings — your API key + model | First-time setup. |

You can use **Vibe** and **Build** without any setup. **Set** and the AI parts need a one-time key
(step 3 below).

---

## 2. Installing it (one time, ~2 minutes)

1. Open a new Chrome tab and go to `chrome://extensions`.
2. Turn on **Developer mode** — the toggle in the top-right corner.
3. Click **Load unpacked** (top-left).
4. Choose the **`extension`** folder from this project and click Select.
5. A little music icon appears in your Chrome toolbar. Click it — the panel opens on the right.

> If you ever change the files, come back to `chrome://extensions` and click the **↻ (reload)** circle
> on the Suno Prompt Studio card to pick up the changes.

---

## 3. One-time setup: your AI key

The AI features (the Vibe tab and the whole Set builder) talk to Anthropic's Claude. You need a key.

1. Get a key from [console.anthropic.com](https://console.anthropic.com) (it looks like `sk-ant-…`).
2. In the panel, click the **⚙ gear** tab.
3. Paste the key into the **Anthropic API key** box.
4. Leave the model on **Sonnet** (best balance) — or pick **Haiku** for faster/cheaper.
5. Click **Save settings**.

**Where your key goes:** it's stored only inside this one Chrome profile, on your computer, and is
only ever sent to Anthropic. It's never shown on screen or logged. **Don't do this on a shared or
public computer.**

> No key? The extension still works — it just falls back to its built-in library instead of writing
> something custom. You'll see a small "showing the built-in version" note when that happens.

---

## 4. Making ONE song

### The easy way — ✨ Vibe
1. Click **✨ Vibe**.
2. Type a feeling or scene: *"heartbreak in an empty apartment at 3am"* — describe the *scene*, not
   just the emotion; it works better.
3. Or flip to **Artist** mode and name a reference: *"sounds like Phoebe Bridgers."* (It turns the
   artist into descriptors — it never uses the name, which is Suno's rule.)
4. Click **Generate**. You get a ready-to-paste **Style** line, an **Exclude** list (what to keep
   out), a **BPM**, a lyric **structure**, and a couple of variations.
5. **Copy** any piece, or **Save to Library** to keep it.

### The hands-on way — 🎛 Build
1. Click **🎛 Build**.
2. Pick a **Genre** and **Era** from the dropdowns.
3. Tap **Mood**, **Instrument**, and **Vocal** chips (tap as many as you like).
4. The preview updates live and warns you if you've added too many words or a contradiction.
5. Use the tag buttons (`[Verse]`, `[Chorus]`, …) to sketch a lyric structure.
6. **Copy style** to paste into Suno, or **Save to Library**.

---

## 5. Making a whole SET (the 🎧 Set tab)

This is the big one — it designs a *playlist* where each track is its own Suno song, and the energy
rises and falls on purpose (like a real DJ set or a wind-down routine). It walks you through it:

### Step 1 — Pick an occasion
Tap a card. **Move** (day party, night drive, grind, workout, focus beats, feel-good) or **Calm /
Focus** (deep focus, meditation, sleep, wind-down, ambient, sound bath, yoga). The card sets the
overall *sound*; you don't need to know any music jargon.

### Step 2 — How long?
- **Total runtime:** 30 min · 1 hour · 2 hours · Custom.
- **Track style:** Standard, Extended, or **DJ-Long** (longer tracks with mix-ready intros/outros).
- A live line tells you **≈ how many tracks and ≈ how many credits** it'll cost. Tip: **DJ-Long makes
  fewer, longer tracks for the same runtime — so it uses fewer credits.**

### Step 3 — Fill in the blank
A little sentence with tappable blanks describes the sound. Tap a blank and pick a suggestion chip,
or type your own. Nothing is ever empty — it starts pre-filled.

### The Lyrics theme (optional, right below the sentence)
Want words? Type or pick a **✍️ Lyrics theme** (e.g. *water & depth*, *shipping at 2am*). Leave it
blank for an instrumental set. **If you add a theme to a normally-instrumental occasion** (like Deep
Focus or Sleep), the set will come back *sung* on that theme — you'll see a gentle heads-up on the
focus ones, since lyrics can pull your attention.

### Fine-tune (optional)
Click **▸ Fine-tune** to override the exact genre, the exact track count, or answer a preset's
sub-question (e.g. Sleep asks restful vs. melancholic).

### Then: Build my set
Click it. The AI designs the arc and every track's brief. You land on the **arc gate**:

- A little energy graph + numbers show the shape of the set.
- **Nudge any track** with **▲ / ▼** to raise or lower its energy — the tempo and the graph update
  right away. (If you make a big jump, it warns you — that's fine, it's your call.)
- **🔁 Recurring motif:** the AI suggests a signature hook/line that will bookend the set (opener +
  closer). Edit it or clear it.
- **Reorder** tracks with ↑/↓, tweak a track's hook, or **Refine in words** ("track 5 deeper", "kill
  the vocals") and it re-plans.

### Generate and paste into Suno
1. Click **Generate all tracks** — each track gets a full Style / Exclude / BPM / lyrics.
2. Open a **suno.com** tab and log in.
3. Back in the panel, click **Paste next → Suno**. It fills Suno's Style and Lyrics boxes for you —
   **you** press Create in Suno (it never submits for you).
4. A **progress bar** and ✓ marks track what you've already pasted, so you can stop and come back
   later and know exactly where you were.

### Your sets are saved automatically
Every set you build is kept. Open **📁 My sets** at the top of the Set tab to reopen one (it drops you
right back where you were), rename it, or delete it.

---

## 6. The Library (📚)

Everything you save lands here, newest first. Search by any word. Each card has **Copy**, **Edit**
(title + tags), and **Delete**. You can also grab text from *any* web page — select it, right-click,
and choose **"Save selection as Suno prompt"** — it shows up here.

---

## 7. Quick help & common questions

- **"It said the AI response was unparseable / showing the built-in version."** A one-off hiccup or a
  missing key. Check your key in ⚙, or just try again.
- **"Paste → Suno did nothing."** Make sure a **suno.com** tab is open and logged in. If it still
  misses, reload the suno.com tab and try again.
- **"I don't see my occasion cards / something looks blank."** Click the **↻ reload** on the card at
  `chrome://extensions`, then reopen the panel.
- **Credits:** each track you generate in Suno costs roughly 10 credits (two variations). The Set tab's
  estimate is your guide before you commit.
- **Nothing here makes health claims.** The wellness presets describe *sounds* (e.g. a "528Hz-tuned
  drone") but never claim to heal or cure anything.

That's it — pick an occasion, or just describe a vibe, and go make something.
