# Suno Prompt Learnings — Master Catalog

Synthesized from the Musci.io guide + three research sweeps (official Suno help center,
community wiki, and practitioner guides). Each section notes **confidence**:
**Official** (help.suno.com), **Confirmed** (3+ independent community sources), or
**Anecdotal** (single source). This doc is the source of truth for the generator's logic.

---

## 0. The mental model

Suno is not a search engine for genres — it's a model that interprets a *creative brief*.
Two fields do different jobs and must not be mixed:

| Field | Holds | Never put here |
|---|---|---|
| **Style of Music** | genre, era, mood, instruments, tempo, vocal type. v4.5+ accepts full sentences. | `[section]` tags, actual lyrics |
| **Lyrics** | the words + `[Verse]`/`[Chorus]` structure tags + `[vocal]`/`[sfx]` tags | genre/style keywords (they get sung) |
| **Exclude** (Advanced Options) | instruments/genres/voices to leave out | — this is Suno's real "negative prompt," not inline `--no` |

**Confidence: Official** — help.suno.com/articles/2415873, /3161921

---

## 1. The 4-component structure (foundation)

`[Genre + Era] · [Mood/Emotion] · [Instruments/Production] · [Vocals]`

- **Genre first, always.** Token weighting front-loads the prompt; if genre lands in
  position 4+, the model reverts to its statistical average. **Confirmed.**
- **Be specific over broad.** "rock" → generic; "2000s garage rock revival, jangly
  guitars" → precise. Subgenre beats parent genre. **Confirmed.**
- **Era = a production package.** "1970s" loads analog warmth; "1980s" loads gated
  reverb + drum machines + glossy synths; "2010s" loads hyper-compression. Swapping era
  often changes the sound more than swapping an instrument. **Confirmed.**

---

## 2. Descriptor count — the sweet spot

- The Musci guide says **4–7**; practitioner analysis says **8–15** quality tags, with
  attention degrading past ~9 and contradictions proliferating past ~15.
- **Working rule the generator uses: 6–12.** Under 5 = under-directed/generic; over 15 =
  later tokens ignored, internal contradictions. **Confirmed (ranges differ by source).**

---

## 3. Tempo & vocals — the two most-skipped specs

- **Always anchor BPM.** No tempo → genre drift to the model's most common tempo. v5.5
  respects BPM consistently. **Confirmed.**
- **Vocals need a 3-layer spec**, not just gender: *character + delivery + effect*. e.g.
  "breathy close-mic female vocal, intimate, light reverb." "female vocals" alone →
  random delivery. Put vocals early; Suno deprioritizes them. **Confirmed.**

---

## 4. Style-field character limit

- Musci & some practitioners cite **~200 chars**; community wiki cites ~3k for the
  lyrics/template area. **Suno does not officially document a style-field char limit.**
- **Generator behavior:** treat ~200 as a soft "keep it tight, front-load the signal"
  guide, not a hard cap. Warn, never block. **Confidence: Anecdotal / unconfirmed.**

---

## 5. Structure tags (go in the LYRICS field)

Square brackets signal a directive, not lyric content. Short/simple tags parse most
reliably. **Official glossary + Confirmed community list.**

- Core: `[Intro] [Verse] [Pre-Chorus] [Chorus] [Bridge] [Outro]`
- Also: `[Hook] [Refrain] [Break] [Drop] [Coda] [Instrumental] [Interlude]`
- Solos / instruments: `[Guitar solo] [Sax solo] [Instrumental break]`
- Functional combos (Confirmed, anecdotal effect): `[Emotional Bridge]`,
  `[Powerful Outro]`, `[Chorus with Drop]`, `[Act I]/[Act II]` for narrative songs.

**Pro move:** write section tags as *functional directives*, not labels —
`[Chorus] explosive release, anthem energy, harmony stack, wider stereo` beats `[Chorus]`.
**Confirmed.**

---

## 6. Voice / dynamics / SFX tags (LYRICS field)

- Vocal: `[Female Vocal] [Male Vocal]`, and richer combos like
  `[masculine low gospel vocal]`, `[feminine high airy vocal]`, `[UK rock male vocal]`
  (gender + register + region + genre). Geography shifts inflection. **Confirmed.**
- Expression/SFX: `[Whispers] [Sighs] [Screams] [Spoken word]`, `[Applause] [Phone ringing]`
  etc. **Anecdotal (observed behavior).**
- In-lyric emphasis: stretch a vowel `goo-o-o-odbye` for melisma; ALL CAPS = louder word;
  ellipses `I... need... you` = dramatic pauses. **Confirmed.**
- **VOCAL DELIVERY belongs in the STYLE field — lyric-field cues are unreliable.**
  ⚠️ CONFIRMED on real Nova Reign generations (2026-07-06), superseding the old "~90% recognized"
  claim: mid-line `(whispered) lyric` → **IGNORED**; bare inline `[Belt]` → **IGNORED**;
  two-bracket `[Chorus] [Belting, Powerful]` / `[Verse] [Soft, Intimate]` → Suno **SANG the
  descriptor OUT LOUD** as lyrics. Put delivery per-section in the STYLE ("breathy intimate
  verses building to a belted chorus, stripped whispered bridge"). In the LYRICS the only
  reliable per-section cue is a **SHORT parenthetical on its OWN line** under a PLAIN section
  tag — `[Bridge]` / `(whispered)` / lyric. Never a second bracket after a section tag, never
  glue the cue to a lyric line, ≤2–3 cues/song. **Confirmed.**
- **Placebo tags — NEVER emit.** Numeric/parameter tags `[Reverb: 30%]`, `[Bass: 80%]`,
  `[Compression: Medium]`, `[Stereo Width: Wide]` do nothing (Suno reads descriptions, not DAW
  knobs). Use words: `reverb-drenched`, `bass-forward`, `compressed vocals`, `wide stereo`.
  **Confirmed** (HookGenius 400+ gen tier list).
- **Rhyme:** ABAB interlocking + SLANT / near rhymes (love/enough/rough) beat sing-song AABB
  perfect rhymes, which trigger nursery-rhyme melodies and read AI-written. **Confirmed.**
- **Syllable ±2:** keep every line within ±2 syllables of the section's count; cramming makes
  Suno rush/glitch/"chipmunk" (a math error, not a bug). **Confirmed.**
- **Pronunciation:** Suno sings SPELLING (no dictionary) — respell names/numbers/tricky words
  phonetically BEFORE generating, permanent after (Evie→Ee-vee, 2am→three A-M, through→thru,
  read[past]→red, 24/7→twenty four seven). **Confirmed.**

---

## 7. Negative prompting / the Exclude feature

- Suno's real mechanism is the **Exclude** field (Advanced Options), not inline syntax.
  Negatives are *guidance, not hard bans* — they lower probability, they don't guarantee
  removal, and they cannot remove sound already rendered (use Song Editor / Replace
  Section / Get Stems for that). **Official + Confirmed.**
- **Use noun-based exclusions:** "no electric guitar" > "less guitar"; "no harsh synth
  lead" > "cleaner." **Confirmed.**
- **Max ~2 exclusions, each paired with a replacement:** "no guitar solo, warm organ
  carries the rhythm." Too many exclusions → hollow, unstable arrangement. **Confirmed.**
- **Genre default traps** (the uninvited sound each genre summons — suppress or pick a
  narrower subgenre):

| Genre | Default it summons | Fix |
|---|---|---|
| Gospel | choir, call-and-response | use "soul ballad"; "no choir, no call-and-response" |
| Reggae | skank/bubble guitar | "no electric guitar, soft organ skank carries rhythm" |
| Cinematic / Orchestral | brass + choir + timpani | "chamber" for intimate; "no choir" |
| Rock | guitar solos | "no guitar solo" if unwanted |
| EDM | harsh screech leads | "warm plucks, controlled highs" |
| Rap / Hip-hop | ad-libs, background shouts | "single lead vocal only, no ad-libs" |

**Confirmed.**

---

## 8. Advanced techniques

- **Layered / 4-layer stack:** genre → timbre → mood → technical params, in order. One
  practitioner: structured stacking took usable first-takes from 30%→70%. **Confirmed.**
- **Scene substitution (highest-leverage):** replace emotion words with concrete
  spatial/temporal scenes — "rainy Sunday afternoon, thinking about someone who moved
  away" instead of "sad." Scenes encode timbre/BPM/harmony the model has co-seen.
  **Confirmed.**
- **Sandwich method:** repeat the most important term first *and* last; Suno weights both
  positions. **Confirmed (Musci) / Anecdotal (effect size).**
- **Emotional-arc design:** lock the structure, vary emotion via arrangement layers
  (strings enter, harmony stacks) — don't change genre mid-track. **Confirmed.**
- **KEEP / CHANGE language** in section blocks reduces random drift between regenerations.
  **Confirmed.**
- **Hook instrument spotlighting:** assign a role ("central hook is the Rhodes") instead of
  listing instruments. **Anecdotal.**
- **Creative sliders (v4.5+):** Weirdness (safe→chaos, 50%=expected), Style Influence
  (loose→strong), Audio Influence (only with an upload). Change one slider at a time; keep
  Weirdness low on choruses, higher on bridges. **Official.**
- **Pop Gravity Well:** training data skews to Verse-Chorus pop; underspecified niche
  requests drift back to pop. Escape via specific subgenres, exclusions, odd time
  signatures, aggressive instrumentation. **Confirmed.**

---

## 9. Artist → descriptor translation (NEVER use the name)

Suno filters artist names and (since the 2026 label settlement) can flag impersonation.
Always decompose into 5 elements: **(1) era + production, (2) genre/subgenre,
(3) 2–3 defining instruments, (4) generic vocal character, (5) mood + rhythmic feel.**
**Confirmed + Official policy.**

| Sound target | Safe descriptor prompt |
|---|---|
| 60s British-invasion pop-rock | 1960s British pop-rock, jangly electric guitar, bass-driven rhythm section, bright snare, tight male vocal harmonies, melodic and upbeat, light reverb, mono warmth |
| 60s Motown soul | 1960s Motown soul, mid-tempo, punchy horn section, tambourine backbeat, warm electric bass, joyful, rich vocals with call-and-response backing |
| 80s synth-pop | 1980s synth-pop, mid-tempo, analog synth arpeggios, gated reverb drums, melancholic, smooth emotive male vocals with lush reverb, atmospheric/neon |
| Early-90s grunge | early 1990s grunge, distorted downtuned guitars, loose heavy drums, melodic bass, angsty/raw, strained male vocals, lo-fi garage, quiet-loud-quiet |
| 90s boom-bap | 1990s boom-bap, 90 BPM, dusty vinyl drum break, warm jazz piano sample, deep upright bass, laid-back/nostalgic, confident relaxed male rap, vinyl warmth |
| 2010s bedroom-pop | 2010s bedroom pop, slow, soft clean electric guitar, mellow drum machine, hazy synth pads, dreamy/introspective, breathy close-mic female vocals, lo-fi |
| Melodic trap / Toronto R&B | atmospheric trap, moody R&B, melodic male vocals, conversational rap, vulnerable, 808 bass, reverb-heavy pads, minimal piano, dark/polished, 78 BPM |
| Dark minimalist pop | dark pop, minimalist, breathy whispered female vocals, ASMR-intimate, sub-bass, sparse electronic production, industrial textures, reverb-drenched, 70 BPM |
| Psychedelic pop | neo-psychedelia, phaser-drenched guitars, analog synth arpeggios, heavily processed male vocals, reverb/delay wash, 70s-inspired-but-modern, dreamy, 110 BPM |
| Psychedelic trap | psychedelic trap, auto-tuned male vocals, ambient 808s, dark atmospheric, layered distorted sound design, cinematic scale |
| Conscious / jazz hip-hop | conscious hip-hop, complex lyrical flow, jazz-influenced beats, West-Coast production, storytelling rap, introspective, warm analog, boom-bap roots |

All are **starting points requiring iteration** — community-created, not platform-tested.

---

## 10. Vibe / feeling → structured prompt

Method: (1) a concrete scene, (2) instrumentation that maps to the mood, (3) vocal
delivery matching emotional weight, (4) production texture. Never emotion words alone.

| Vibe | Full prompt |
|---|---|
| Nostalgic late-night drive | dark ambient R&B, 72 BPM, warm synth pads, slow rolling bass, reverb-drenched minimal piano, conversational melancholic male vocals, late-night city feel, intimate |
| Heartbreak, empty apartment | indie folk, slow/sparse, 65 BPM, fingerpicked acoustic guitar, soft cello undertones, intimate female vocals with slight rasp, raw/vulnerable, close-mic, lo-fi warmth |
| Euphoric festival sunrise | uplifting progressive house, 124 BPM, shimmering synth pads, four-on-the-floor kick, rolling bass, melodic plucks, long build to cathartic release, fully instrumental |
| Summer road trip | indie pop, upbeat/carefree, 105 BPM, jangly electric guitar, warm punchy drums, bright synth accents, harmonized female chorus, summer nostalgia, wide-open feeling |
| Wistful coffee, alone | lo-fi bedroom jazz, 78 BPM, soft upright bass, brushed snare, muted piano, distant muted trumpet, melancholic/warm, dusty vinyl, fully instrumental |
| Defiant comeback anthem | arena rock, 128 BPM, distorted power chords, driving bass, stadium drums w/ room reverb, belting powerful male vocals, determined/raw, anthemic chorus, synth swell |
| Deep grief, early winter | orchestral ballad, 55 BPM, string quartet, solo piano, sparse, gentle restrained baritone, quiet grief, no percussion, winter desolation, long silences |

---

## 11. Failure modes (what reliably breaks)

1. **Contradiction stacking** — "aggressive + peaceful", "lo-fi + studio quality",
   "minimal + orchestral", "fast + melancholic" → muddy average. Pick one per axis.
2. **Tag overload past ~15** — later tokens ignored; contradictions creep in.
3. **Genre not first** → statistical-average output.
4. **Abstract/evaluative words** — "beautiful, amazing, emotional, powerful, perfect"
   carry zero sonic info. Replace with sonic terms.
5. **Style/lyrics emotional mismatch** — sad style + cheerful lyrics → incoherent.
6. **Missing BPM / missing vocal direction.**
7. **Artist names** — blocked + impersonation risk.
8. **Section tags in the style field** (they belong in lyrics).
9. **Over-exclusion** (>2 negatives, no replacements) → hollow arrangement.
10. **Single-generation expectation** — ~70% of first tracks need 3+ regenerations.
    Generate 3–5, iterate.
11. **Extending without re-pasting style + BPM** → tempo drift, vocal gender switching.
12. **Delivery cues in a second bracket** (`[Chorus] [Belting, Powerful]`) or glued to a lyric
    line → the descriptor gets SUNG out loud, or ignored. Put delivery in STYLE; lyric cues only
    as an own-line parenthetical. (Confirmed 2026-07-06.)
13. **Placebo/parameter tags** (`[Reverb: 30%]`, `[Bass: 80%]`) → zero effect; use words.
14. **Uneven syllable counts** (lines varying more than ±2 syllables) → rushed / glitch /
    "chipmunk" vocals.

**Confirmed.**

---

## 12. Model versions (context)

- **v4.5** (May 2025): conversational prompts, Enhance button, Weirdness/Style sliders,
  8-min songs, better adherence + mashups, Lyrics field accepts supplementary style.
- **v5 / v5.5** (current): Voices (voice cloning, replaced Personas), Custom Models,
  My Taste, stronger structural coherence. Old rigid 2024 comma-keyword prompts
  underperform on v5.5 vs natural-language scene descriptions.

**Official.** ("chirp-crow" is a third-party API vendor term, NOT official.)

---

## Sources

Official: help.suno.com (articles 2415873, 2462273, 5782849, 5782593, 5782977, 5804417,
6141377, 9010177, 3161921, 3484161, 11362305/369/497/561). Community: sunoaiwiki.com,
jackrighteous.com, roo.beehiiv.com, hookgenius.app, suno.bi, sunoarchitect.com,
alex-hustler / james-palm / travisnicholson (Medium), learnprompting.org, Jamie Aplin (YT),
and the originating Musci.io guide.
