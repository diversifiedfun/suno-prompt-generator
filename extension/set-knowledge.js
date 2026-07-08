// set-knowledge.js — functional-set catalog as data. Sourced from
// docs/functional-set-learnings.md (Phase 0 research). Each Preset seeds a set;
// party presets are distilled from skill/references/dj-set-playbook.md.

// bpmPolicy: {kind:"range",lo,hi} | {kind:"beatless"} | {kind:"descend",steps:[...]}

export const PRESETS = [
  // ---- Party family (tested — distilled from the DJ playbook) ----
  {
    key: "day-floor-peak",
    label: "Day-Floor Peak",
    family: "party",
    maturity: "tested",
    arcType: "sustained-peak",
    defaultContour: [6, 7, 7, 8, 8, 8, 9, 9],
    energyBand: [6, 9],
    bpmPolicy: { kind: "range", lo: 122, hi: 128 },
    vocalDefault: "full-lead",
    palette: [
      "funky booty house",
      "punchy kick",
      "gritty claps",
      "filthy bassline",
      "diva vocal chops",
    ],
    doWords: ["funky", "filthy", "driving", "sun-soaked", "relentless"],
    dontWords: ["gentle", "mellow", "dreamy", "sleepy", "ambient-drift"],
    structurePolicy: {
      allow: ["[Intro]", "[Build]", "[Drop]", "[Break]", "[Outro]"],
      ban: [],
    },
    evidenceNote:
      "From UNDER THE MISTERS; energy-killer words banned at a peak day-floor slot.",
  },
  {
    key: "deep-focus-house",
    label: "Deep-Focus House",
    family: "party",
    maturity: "tested",
    arcType: "journey",
    defaultContour: [4, 5, 5, 6, 6, 7, 6, 7],
    energyBand: [4, 7],
    bpmPolicy: { kind: "range", lo: 124, hi: 128 },
    vocalDefault: "wordless",
    palette: [
      "deep hypnotic house",
      "rolling sub bass",
      "submerged pads",
      "dub chords",
      "sultry vocal float",
    ],
    doWords: ["hypnotic", "submerged", "deep", "rolling", "effortless"],
    dontWords: ["aggressive", "gang-chant", "banging", "harsh"],
    structurePolicy: {
      allow: ["[Intro]", "[Build]", "[Break]", "[Outro]"],
      ban: [],
    },
    evidenceNote:
      "From LOCK-IN; water/depth imagery, aggression is the failure mode.",
  },
  {
    key: "night-drive-dnb",
    label: "Night Drive (DnB)",
    family: "party",
    maturity: "tested",
    arcType: "journey",
    defaultContour: [5, 6, 6, 7, 7, 8, 7, 8],
    energyBand: [5, 8],
    bpmPolicy: { kind: "range", lo: 170, hi: 174 },
    vocalDefault: "full-lead",
    palette: [
      "liquid neuro dnb",
      "rolling breakbeat",
      "warm reese bass",
      "neon synth wash",
      "sultry sung vocal",
    ],
    doWords: ["nocturnal", "liquid", "propulsive", "neon", "sleek"],
    dontWords: ["cheesy", "harsh", "sluggish"],
    structurePolicy: {
      allow: ["[Intro]", "[Build]", "[Drop]", "[Break]", "[Outro]"],
      ban: [],
    },
    evidenceNote:
      "From NEON MILE; long bar-count intros/outros for mixing extend track length.",
  },
  {
    key: "grind-hype",
    label: "Grind / Hype",
    family: "party",
    maturity: "tested",
    arcType: "sustained-peak",
    defaultContour: [6, 7, 7, 8, 8, 8, 9, 9],
    energyBand: [6, 9],
    bpmPolicy: { kind: "range", lo: 140, hi: 160 },
    vocalDefault: "chant",
    palette: [
      "phonk hard trap",
      "distorted 808",
      "cowbell",
      "aggressive rapped bars",
      "gang chant",
    ],
    doWords: ["relentless", "pounding", "gritty", "beast-mode", "surging"],
    dontWords: ["gentle", "mellow", "dreamy", "lounge"],
    structurePolicy: {
      allow: ["[Intro]", "[Verse]", "[Hook]", "[Outro]"],
      ban: [],
    },
    evidenceNote: "From NO DAYS OFF; aggressive rapped (not spoken) bars.",
  },

  // ---- Wellness family ----
  {
    key: "sleep",
    label: "Sleep",
    family: "wellness",
    maturity: "sourced",
    arcType: "descending",
    defaultContour: [3, 3, 2, 2, 2, 1, 1, 1],
    energyBand: [1, 3],
    bpmPolicy: {
      kind: "descend",
      steps: ["70-75 BPM", "60-65 BPM", "beatless, no fixed tempo"],
    },
    vocalDefault: "none",
    palette: [
      "solo felt piano",
      "slow-attack warm pad",
      "long-held bowed strings",
      "tape warmth",
      "distant wordless choir pad",
    ],
    doWords: ["slow", "sustained", "legato", "soft", "consonant", "beatless"],
    dontWords: [
      "percussion",
      "accented beats",
      "staccato",
      "sudden dynamics",
      "lyrics",
      "key change",
    ],
    structurePolicy: {
      allow: ["[Intro]", "[Interlude]", "[Outro]"],
      ban: ["[Chorus]", "[Drop]", "[Hook]"],
    },
    subChoices: [
      {
        key: "mood",
        prompt:
          "Restful-neutral (major/Dorian — sleep-science default) or melancholic (minor)?",
        options: ["restful-neutral (major/Dorian)", "melancholic (minor)"],
      },
    ],
    evidenceNote:
      "60–80 BPM instrumental is peer-reviewed (Pan & Wang 2025; Feng 2018). RCTs favor major/Dorian over minor.",
  },
  {
    key: "relaxation",
    label: "Relaxation / Calm",
    family: "wellness",
    maturity: "sourced",
    arcType: "descending",
    defaultContour: [4, 4, 3, 3, 3, 2, 2, 1],
    energyBand: [2, 4],
    bpmPolicy: { kind: "range", lo: 60, hi: 80 },
    vocalDefault: "none",
    palette: [
      "atmospheric pads",
      "spacious reverb tails",
      "wide-spaced single-note piano",
      "modal Dorian phrases",
      "sus2 sus4 slow-resolving chords",
    ],
    doWords: ["gentle", "sustained", "spacious", "warm", "floating"],
    dontWords: [
      "abrupt transients",
      "triplet rhythms",
      "dissonance",
      "dramatic modulation",
      "loudness spikes",
    ],
    structurePolicy: {
      allow: ["[Intro]", "[Interlude]", "[Outro]"],
      ban: ["[Drop]", "[Hook]"],
    },
    evidenceNote:
      "First track must hold target tempo ≥5 min (entrainment lag). Balance repetition vs controlled novelty.",
  },
  {
    key: "ambient-soundscape",
    label: "Ambient / Soundscape",
    family: "wellness",
    maturity: "sourced",
    arcType: "steady",
    defaultContour: [2, 2, 2, 1, 2, 1, 1, 1],
    energyBand: [1, 2],
    bpmPolicy: { kind: "beatless" },
    vocalDefault: "none",
    palette: [
      "sustained drones",
      "asynchronous phasing loops",
      "slowed smeared Rhodes",
      "continuous field-recording bed",
      "pink-noise texture",
    ],
    doWords: ["drone", "evolving", "generative", "phasing", "seamless"],
    dontWords: [
      "melody-forward",
      "hooks",
      "verse-chorus",
      "percussion",
      "audible loop seam",
    ],
    structurePolicy: {
      allow: ["[Intro]", "[Interlude]", "[Outro]"],
      ban: ["[Chorus]", "[Drop]", "[Hook]", "[Verse]"],
    },
    evidenceNote:
      "Eno technique: mismatched-length loops that never realign. Loop-seam invisibility is the top failure mode.",
  },
  {
    key: "meditation",
    label: "Meditation",
    family: "wellness",
    maturity: "sourced",
    arcType: "steady",
    defaultContour: [2, 2, 3, 3, 3, 2, 2, 1],
    energyBand: [1, 3],
    bpmPolicy: { kind: "beatless" },
    vocalDefault: "none",
    palette: [
      "sustained drone pad",
      "shruti box harmonium",
      "Tibetan singing bowls",
      "wordless ahh choir pad",
      "long reverb tails",
    ],
    doWords: ["drone", "resonant", "spacious", "wordless", "unhurried"],
    dontWords: [
      "danceable",
      "syncopated",
      "sudden dynamics",
      "busy percussion",
      "build",
      "drop",
    ],
    structurePolicy: {
      allow: ["[Intro]", "[Interlude]", "[Outro]"],
      ban: ["[Chorus]", "[Drop]", "[Hook]", "[Verse]"],
    },
    subChoices: [
      {
        key: "guide",
        prompt: "Purely tonal, or a soft spoken breath-guide?",
        options: [
          "tonal (no voice)",
          "soft spoken breath-guide (4-6 breaths/min)",
        ],
      },
    ],
    evidenceNote:
      "Prefer 'beatless' over a BPM number (a stated BPM invites a beat). 60-BPM-syncs-heart-rate is pseudoscience.",
  },
  {
    key: "sound-healing",
    label: "Sound Healing",
    family: "wellness",
    maturity: "sourced",
    arcType: "steady",
    defaultContour: [1, 1, 2, 2, 2, 2, 1, 1],
    energyBand: [1, 2],
    bpmPolicy: { kind: "beatless" },
    vocalDefault: "none",
    palette: [
      "crystal singing bowls long decay",
      "gong wash",
      "tuning-fork tones",
      "frequency-tuned drone pad",
      "soft overtone chant",
    ],
    doWords: [
      "singing bowl",
      "resonant tone",
      "harmonic overtone",
      "sustained drone",
      "long decay",
    ],
    dontWords: [
      "upbeat",
      "melodic hook",
      "rhythmic",
      "vocal lead",
      "verse-chorus",
    ],
    structurePolicy: {
      allow: ["[Intro]", "[Interlude]", "[Outro]"],
      ban: ["[Chorus]", "[Drop]", "[Hook]", "[Verse]"],
    },
    claimGuard: [
      "repairs DNA",
      "entrains your brain",
      "syncs your heartbeat",
      "heals your body",
      "cures",
    ],
    evidenceNote:
      "Frequency labels (e.g. '528Hz-tuned drone') are legit PRODUCTION descriptors. The medical claims are pseudoscience/mixed — never emit them.",
  },
  {
    key: "yoga-spa",
    label: "Yoga / Spa",
    family: "wellness",
    maturity: "sourced",
    arcType: "journey",
    defaultContour: [2, 3, 3, 4, 4, 3, 3, 2],
    energyBand: [2, 4],
    bpmPolicy: { kind: "range", lo: 60, hi: 90 },
    vocalDefault: "wordless",
    palette: [
      "warm analog pads",
      "soft kalimba arps",
      "shruti box drone",
      "gentle frame drum",
      "flute/duduk lines",
      "nature layers",
    ],
    doWords: ["warm", "organic", "gentle pulse", "flowing", "restorative"],
    dontWords: [
      "aggressive",
      "four-on-the-floor kick",
      "EDM drop",
      "harsh synth lead",
      "sudden dynamic shifts",
    ],
    structurePolicy: {
      allow: ["[Intro]", "[Interlude]", "[Outro]"],
      ban: ["[Drop]", "[Hook]"],
    },
    evidenceNote:
      "Mild warm-up→flow→savasana rise; the 'peak' rises in warmth, not intensity. Practice-pacing convention.",
  },
  {
    key: "motivation-workout",
    label: "Motivation / Workout",
    family: "wellness",
    maturity: "sourced",
    arcType: "ascending",
    defaultContour: [3, 5, 6, 7, 8, 8, 8, 6],
    energyBand: [5, 8],
    bpmPolicy: { kind: "range", lo: 128, hi: 150 },
    vocalDefault: "chant",
    palette: [
      "punchy kick",
      "driving rolling bass",
      "syncopated trap hats",
      "sparing brass stab",
      "gang-vocal chant",
    ],
    doWords: ["driving", "relentless", "pounding", "surging", "propulsive"],
    dontWords: ["gentle", "mellow", "dreamy", "sleepy", "lounge", "smooth"],
    structurePolicy: {
      allow: ["[Intro]", "[Verse]", "[Pre-Chorus]", "[Chorus]", "[Outro]"],
      ban: [],
    },
    evidenceNote:
      "128-150 BPM well-sourced (Karageorghis 125 BPM = +15% endurance). Solo psych-up, not a crowd peak (never 9-10).",
  },
  {
    key: "deep-focus",
    label: "Deep Focus",
    family: "wellness",
    maturity: "sourced",
    arcType: "steady",
    defaultContour: [4, 5, 5, 5, 5, 5, 5, 4],
    energyBand: [3, 5],
    bpmPolicy: { kind: "range", lo: 60, hi: 90 },
    vocalDefault: "instrumental",
    palette: [
      "warm filtered Rhodes loop",
      "soft vinyl crackle",
      "sustained pad",
      "muted lo-fi drums",
      "minimal filtered sub",
    ],
    doWords: ["steady", "sustained", "filtered", "understated", "looping"],
    dontWords: [
      "sudden",
      "drop",
      "scream",
      "chant",
      "hook",
      "big swell",
      "key-change",
      "spoken word",
      "any lyric",
    ],
    structurePolicy: {
      allow: ["[Intro]", "[Instrumental]", "[Interlude]", "[Outro]"],
      ban: ["[Chorus]", "[Drop]", "[Hook]", "[Verse]"],
    },
    setWideExclude: ["no sudden dynamic shifts", "no spoken word"],
    lyricWarn:
      "Lyrics can pull focus — Deep Focus works best instrumental. Add them anyway?",
    evidenceNote:
      "HARD RULE: no intelligible lyrics (Souza & Barbosa 2023 — lyrics hurt memory/comprehension d≈-0.3).",
  },
  {
    key: "uplifting",
    label: "Uplifting",
    family: "wellness",
    maturity: "starter",
    arcType: "journey",
    defaultContour: [4, 5, 6, 7, 7, 6, 6, 5],
    energyBand: [4, 7],
    bpmPolicy: { kind: "range", lo: 100, hi: 128 },
    vocalDefault: "full-lead",
    palette: [
      "bright clean guitar strums",
      "major-key piano",
      "warm horn stabs",
      "handclaps",
      "wide shimmering pads",
      "group backing vocals",
    ],
    doWords: ["bright", "warm", "buoyant", "radiant", "open", "major-key"],
    dontWords: [
      "minor-key gloom",
      "distorted",
      "industrial",
      "monotone",
      "brooding",
    ],
    structurePolicy: {
      allow: [
        "[Intro]",
        "[Verse]",
        "[Pre-Chorus]",
        "[Chorus]",
        "[Bridge]",
        "[Outro]",
      ],
      ban: [],
    },
    evidenceNote:
      "Major vs minor mode is the highest-leverage positivity lever (2024 mode-perception review). One clear peak, warm landing.",
  },
];

// New Exclude-field traps for functional categories (additive to knowledge.js GENRE_TRAPS).
export const SET_GENRE_TRAPS = {
  "Lo-fi instrumental": {
    summons: "cliché rain/ocean/white-noise SFX",
    fix: "no rain/ocean sfx, sustained pad texture instead",
  },
  "Focus ambient": {
    summons: "cliché rain/ocean/white-noise SFX",
    fix: "no rain/ocean sfx, sustained pad texture instead",
  },
  "Uplifting pop": {
    summons: "saccharine final-chorus key-change",
    fix: "no key-change modulation, sustain the groove",
  },
  "Motivational trap": {
    summons: "aggressive/explicit ad-libs",
    fix: "gym-crowd chant energy, no explicit aggression",
  },
};

// Functional-specific contradiction pairs (additive to knowledge.js CONTRADICTIONS).
// Reserved for arc-gate contradiction warnings (deferred follow-up — not yet wired).
export const SET_CONTRADICTIONS = [
  ["beatless", "bpm"],
  ["instrumental", "vocal hook"],
  ["steady", "anthemic build"],
  ["low-distraction", "big dynamic swell"],
];

// Pickable menus so building a set is "choose the vibe + theme", not a blank box.
// VIBE = how it feels (pick 1–2). THEME = the metaphor world the lyrics live in
// (pick ONE per set — it's the cohesion glue, e.g. LOCK-IN = water/depth).
export const VIBES = [
  "Aggressive",
  "Dark / Nocturnal",
  "Dreamy",
  "Driving",
  "Euphoric",
  "Gritty",
  "Hypnotic",
  "Relentless",
  "Sleek",
  "Sultry",
  "Uplifting",
  "Warm / Restful",
];

export const THEMES = [
  "Cosmic / Space",
  "Fire / Heat",
  "Flight / Weightless",
  "Grind / Iron / Discipline",
  "Love / Longing",
  "Nature / Elements",
  "Night Drive / Neon / City",
  "Power / Triumph",
  "Streets / Hustle",
  "Water / Depth / Submersion",
];

// Mad-libs dropdown pools (Task: richer sentence templates). Each backs a
// <select> in the Set tab intake — kept curated + tasteful, not exhaustive.
export const ENERGY = [
  "hypnotic",
  "driving",
  "euphoric",
  "relentless",
  "dreamy",
  "dark",
  "sultry",
  "uplifting",
  "gritty",
  "warm",
];

export const TEXTURE = [
  "submerged",
  "glassy",
  "warm",
  "cavernous",
  "crystalline",
  "smoky",
  "saturated",
  "airy",
  "metallic",
  "organic",
  "neon",
  "liquid",
];

export const ARRANGEMENT = [
  "instrumental",
  "mostly instrumental",
  "synth-led",
  "organic and live",
  "stripped-back",
  "wall-of-sound",
];

export const PERCUSSION = [
  "rolling breakbeats",
  "four-on-the-floor",
  "halftime swing",
  "no drums",
  "tribal percussion",
  "skittering hats",
  "dub bass",
];

export const PEAK = [
  "a euphoric peak",
  "a filthy drop",
  "a weightless release",
  "a relentless climb",
  "a slow dissolve",
  "a hands-up moment",
];

export const VOCAL = [
  "soaring",
  "breathy",
  "gritty",
  "chanted",
  "sultry",
  "anthemic",
  "whispered",
  "half-sung",
];

// Occasion cards — the single source of truth for the card grid. One row per
// preset (coverage-tested). `label` is the everyday occasion noun shown on the
// card and slotted into the mad-libs sentence; `about` seeds the lyric-theme blank
// for vocal occasions.
export const OCCASIONS = [
  {
    presetKey: "day-floor-peak",
    emoji: "☀️",
    label: "day party",
    group: "move",
    about: "sun, dancing, the crowd",
  },
  {
    presetKey: "night-drive-dnb",
    emoji: "🌌",
    label: "night drive",
    group: "move",
    about: "neon streets, moving fast",
  },
  {
    presetKey: "grind-hype",
    emoji: "🔥",
    label: "grind session",
    group: "move",
    about: "discipline, no days off",
  },
  {
    presetKey: "motivation-workout",
    emoji: "💪",
    label: "workout",
    group: "move",
    about: "pushing past the limit",
  },
  {
    presetKey: "deep-focus-house",
    emoji: "🎶",
    label: "focus set",
    group: "move",
    about: "locked in, in the zone",
  },
  {
    presetKey: "uplifting",
    emoji: "✨",
    label: "feel-good set",
    group: "move",
    about: "brighter days, gratitude",
  },
  {
    presetKey: "deep-focus",
    emoji: "🎯",
    label: "deep focus block",
    group: "calm",
  },
  { presetKey: "meditation", emoji: "🧘", label: "meditation", group: "calm" },
  { presetKey: "sleep", emoji: "🌙", label: "sleep", group: "calm" },
  { presetKey: "relaxation", emoji: "🕯️", label: "wind-down", group: "calm" },
  {
    presetKey: "ambient-soundscape",
    emoji: "🌊",
    label: "ambient bed",
    group: "calm",
  },
  {
    presetKey: "sound-healing",
    emoji: "🔔",
    label: "sound bath",
    group: "calm",
  },
  { presetKey: "yoga-spa", emoji: "🎶", label: "yoga flow", group: "calm" },
];

export function getOccasion(presetKey) {
  return OCCASIONS.find((o) => o.presetKey === presetKey);
}

const VOCAL_DEFAULTS = new Set(["full-lead", "chant"]);

// Seed a blank's default from the preset's curated doWords when one exactly
// matches an option in that slot's pool (skipping `exclude` so a second blank
// pulling from the same pool doesn't just repeat the first blank's word);
// otherwise fall back to the pool's first option (or its first non-excluded
// option).
function seedDefault(pool, doWords, exclude) {
  const match = (doWords || []).find((w) => pool.includes(w) && w !== exclude);
  if (match) return match;
  return pool.find((w) => w !== exclude) || pool[0];
}

// A renderable mad-libs template for the occasion. `parts` interleaves literal
// text with blank descriptors {slot,pool,default,control}; the UI renders each
// `control:"select"` blank as a pre-filled <select> so there is never an empty
// box. The sentence is sound-only — the lyric theme lives in its own
// always-visible UI control (see Task 4), not as a blank here.
export function occasionSentence(preset) {
  const occ = getOccasion(preset.key);
  const label = occ ? occ.label : preset.label.toLowerCase();
  const d = preset.doWords || [];
  const energyDefault = seedDefault(ENERGY, d);
  const percussionDefault = seedDefault(PERCUSSION, d);
  const peakDefault = seedDefault(PEAK, d);
  const blank = (slot, pool, def) => ({
    slot,
    pool,
    default: def,
    control: "select",
  });
  if (VOCAL_DEFAULTS.has(preset.vocalDefault)) {
    return {
      category: "vocal",
      parts: [
        "A ",
        blank("energy", "ENERGY", energyDefault),
        ` ${label} with `,
        blank("vocal", "VOCAL", seedDefault(VOCAL, d)),
        " vocals that feels ",
        blank("mood", "MOOD", seedDefault(VIBES, d)),
        ", over ",
        blank("percussion", "PERCUSSION", percussionDefault),
        " — landing on ",
        blank("peak", "PEAK", peakDefault),
        ".",
      ],
    };
  }
  const textureDefault = seedDefault(TEXTURE, d);
  return {
    category: "instrumental",
    parts: [
      "A ",
      blank("energy", "ENERGY", energyDefault),
      ` ${label} that sounds `,
      blank("texture", "TEXTURE", textureDefault),
      " and ",
      blank("texture2", "TEXTURE", seedDefault(TEXTURE, d, textureDefault)),
      ", ",
      blank("arrangement", "ARRANGEMENT", seedDefault(ARRANGEMENT, d)),
      " with ",
      blank("percussion", "PERCUSSION", percussionDefault),
      " — building to ",
      blank("peak", "PEAK", peakDefault),
      ".",
    ],
  };
}

// Map the filled sentence blanks onto existing planSet params. SCENE colors the
// SOUND, VIBE are mood words. THEME no longer comes from here — it comes from
// the dedicated lyrics-theme UI control (Task 4). `peak` is a mood phrase, not
// a sound descriptor, so it's kept out of scene/vibe to keep both readable.
export function blanksToPlanParams(preset, blanks = {}) {
  const trimmed = (v) => String(v || "").trim();
  if (VOCAL_DEFAULTS.has(preset.vocalDefault)) {
    const vocalPhrase =
      trimmed(blanks.vocal) && `${trimmed(blanks.vocal)} vocals`;
    return {
      scene: [vocalPhrase, trimmed(blanks.percussion)]
        .filter(Boolean)
        .join(", "),
      vibe: [trimmed(blanks.energy), trimmed(blanks.mood)].filter(Boolean),
    };
  }
  return {
    scene: [
      trimmed(blanks.texture),
      trimmed(blanks.texture2),
      trimmed(blanks.arrangement),
      trimmed(blanks.percussion),
    ]
      .filter(Boolean)
      .join(", "),
    vibe: [trimmed(blanks.energy)].filter(Boolean),
    theme: "",
  };
}

export function getPreset(key) {
  return PRESETS.find((p) => p.key === key);
}

// Returns a list of schema problems; empty array = valid.
export function validatePreset(p) {
  const problems = [];
  const req = [
    "key",
    "label",
    "family",
    "maturity",
    "arcType",
    "defaultContour",
    "energyBand",
    "bpmPolicy",
    "vocalDefault",
    "palette",
    "doWords",
    "dontWords",
    "structurePolicy",
  ];
  for (const f of req) if (p[f] === undefined) problems.push(`missing ${f}`);
  if (p.defaultContour && !Array.isArray(p.defaultContour))
    problems.push("defaultContour not array");
  if (
    p.energyBand &&
    (!Array.isArray(p.energyBand) || p.energyBand.length !== 2)
  )
    problems.push("energyBand must be [min,max]");
  if (p.structurePolicy && (!p.structurePolicy.allow || !p.structurePolicy.ban))
    problems.push("structurePolicy needs allow+ban");
  if (p.family && !["party", "wellness"].includes(p.family))
    problems.push("bad family");
  if (p.maturity && !["tested", "sourced", "starter"].includes(p.maturity))
    problems.push("bad maturity");
  return problems;
}
