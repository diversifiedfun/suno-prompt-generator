// knowledge.js — Suno prompt knowledge base (read-only reference data).
// Synthesized from docs/suno-prompt-learnings.md. ES module; imported by the side panel
// and the generator. Never mutated at runtime.

// --- 4-component vocabularies (the builder chips) ---------------------------

// Genres grouped into alphabetized families, each with alphabetized subgenres.
// Rendered as <optgroup> in the Build tab so genre→subgenre is scannable, plus a
// filter box for type-to-find. Electronic/dance families are stocked deep
// (house, DnB/breaks, phonk/hard, techno) per the styles Molly actually makes.
export const GENRE_GROUPS = [
  {
    family: "Ambient & Lo-fi",
    genres: [
      "Ambient",
      "Ambient electronic",
      "Chillhop",
      "Chillwave",
      "Downtempo",
      "Drone",
      "Lo-fi hip-hop",
      "Lo-fi jazz",
      "New age",
      "Vaporwave",
    ],
  },
  {
    family: "Bass & Dubstep",
    genres: ["Dubstep", "Future bass", "Riddim", "Trap (EDM)"],
  },
  {
    family: "Classical & Cinematic",
    genres: [
      "Baroque",
      "Choral",
      "Cinematic",
      "Neoclassical",
      "Orchestral",
      "String quartet",
    ],
  },
  {
    family: "Country & Americana",
    genres: [
      "Alt-country",
      "Americana",
      "Bluegrass",
      "Modern country",
      "Outlaw country",
    ],
  },
  {
    family: "Drum & Bass & Breaks",
    genres: [
      "2-step",
      "Breakbeat",
      "Drum and bass",
      "Halftime DnB",
      "Jump-up DnB",
      "Jungle",
      "Liquid DnB",
      "Neurofunk",
      "UK garage",
    ],
  },
  {
    family: "Hip-hop & Rap",
    genres: [
      "Boom bap",
      "Conscious hip-hop",
      "Drill",
      "G-funk",
      "Melodic rap",
      "Trap",
    ],
  },
  {
    family: "House",
    genres: [
      "Afro house",
      "Bass house",
      "Booty house",
      "Deep house",
      "Disco house",
      "Funky house",
      "Jackin' house",
      "Melodic house",
      "Nu-disco",
      "Organic house",
      "Progressive house",
      "Tech house",
    ],
  },
  {
    family: "Jazz",
    genres: [
      "Bebop",
      "Bossa nova",
      "Cool jazz",
      "Jazz fusion",
      "Smooth jazz",
      "Vocal jazz",
    ],
  },
  {
    family: "Metal",
    genres: [
      "Black metal",
      "Death metal",
      "Doom metal",
      "Heavy metal",
      "Metalcore",
      "Thrash metal",
    ],
  },
  {
    family: "Phonk & Hard Dance",
    genres: [
      "Drift phonk",
      "Hard techno",
      "Hard trap",
      "Hardstyle",
      "Phonk",
      "Rawstyle",
    ],
  },
  {
    family: "Pop",
    genres: [
      "Bedroom pop",
      "Dark pop",
      "Electropop",
      "Hyperpop",
      "Indie pop",
      "K-pop",
      "Pop",
      "Synth-pop",
    ],
  },
  {
    family: "R&B & Soul",
    genres: [
      "Alternative R&B",
      "Classic soul",
      "Neo-soul",
      "Quiet storm",
      "Trap soul",
    ],
  },
  {
    family: "Rock",
    genres: [
      "Alternative rock",
      "Arena rock",
      "Classic rock",
      "Grunge",
      "Indie rock",
      "Post-punk",
      "Psychedelic rock",
      "Stoner rock",
      "Surf rock",
    ],
  },
  {
    family: "Techno & Minimal",
    genres: [
      "Dub techno",
      "Melodic techno",
      "Minimal techno",
      "Peak-time techno",
      "Techno",
    ],
  },
  {
    family: "Trance & Synth",
    genres: ["Progressive trance", "Psytrance", "Synthwave", "Trance"],
  },
];

// Flat list (derived) — kept for any consumer that wants a simple array.
export const GENRES = GENRE_GROUPS.flatMap((g) => g.genres);

export const ERAS = [
  "1960s",
  "1970s",
  "1980s",
  "1990s",
  "2000s",
  "2010s",
  "2020s",
  "retrofuturistic",
  "vintage",
  "modern",
];

export const MOODS = {
  Uplifting: ["uplifting", "triumphant", "euphoric", "hopeful", "anthemic"],
  Melancholic: [
    "melancholic",
    "bittersweet",
    "nostalgic",
    "wistful",
    "introspective",
  ],
  Dark: ["aggressive", "intense", "dark", "moody", "brooding", "angsty"],
  Serene: ["serene", "peaceful", "dreamy", "hazy", "meditative", "floating"],
  Playful: ["playful", "quirky", "energetic", "groovy", "sultry", "confident"],
};

export const INSTRUMENTS = {
  Electronic: [
    "analog synth arpeggios",
    "drum machine",
    "808 bass",
    "pulsing synths",
    "shimmering synth pads",
    "soaring lead synth",
    "vocoder",
  ],
  Traditional: [
    "fingerpicked acoustic guitar",
    "distorted guitars",
    "jangly electric guitar",
    "piano",
    "string quartet",
    "punchy horn section",
    "saxophone",
    "pedal steel",
    "upright bass",
  ],
  Production: [
    "vinyl crackle",
    "tape saturation",
    "reverb-drenched",
    "gated reverb drums",
    "clean mix",
    "lo-fi warmth",
    "wide stereo",
    "close-mic intimate",
  ],
  Texture: [
    "warm Rhodes chords",
    "gritty bass",
    "four-on-the-floor",
    "hypnotic rhythms",
    "driving rhythm",
    "brushed snare",
    "muted trumpet",
  ],
};

export const VOCALS = {
  Voice: [
    "female vocals",
    "male vocals",
    "male baritone",
    "male falsetto",
    "mixed choir",
    "group vocals",
    "soprano",
    "instrumental only",
    "no vocals",
  ],
  Delivery: [
    "breathy",
    "powerful belting",
    "whispered",
    "raw",
    "raspy",
    "conversational",
    "soft close-mic",
    "storytelling",
    "auto-tuned",
  ],
  Effect: [
    "lush reverb",
    "light reverb",
    "ASMR-intimate",
    "harmonized",
    "doubled",
    "dry/upfront",
  ],
};

// --- Lyrics-field tags (official + community-confirmed) ---------------------

export const STRUCTURE_TAGS = [
  "Intro",
  "Verse",
  "Pre-Chorus",
  "Chorus",
  "Bridge",
  "Outro",
  "Hook",
  "Refrain",
  "Break",
  "Drop",
  "Instrumental",
  "Interlude",
  "Guitar solo",
  "Sax solo",
];

export const VOICE_TAGS = [
  "Female Vocal",
  "Male Vocal",
  "Whispers",
  "Spoken word",
  "Belting",
  "Falsetto",
  "Harmonized",
  "Screams",
  "Sighs",
  "feminine high airy vocal",
  "masculine low gospel vocal",
];

export const DYNAMICS_TAGS = [
  "Soft-spoken",
  "Shouted",
  "Building intensity",
  "Fading vocals",
  "Echoing softly",
];

// --- Negatives / Exclude ----------------------------------------------------

export const NEGATIVES = [
  "no vocals",
  "no electric guitar",
  "no choir",
  "no ad-libs",
  "no harsh synth lead",
  "no autotune",
  "no brass",
  "no drums",
];

// Genre default-traps: the uninvited sound + the recommended replacement.
export const GENRE_TRAPS = {
  Gospel: {
    summons: "choir, call-and-response",
    fix: "no choir, no call-and-response",
  },
  Reggae: {
    summons: "skank guitar",
    fix: "no electric guitar, soft organ skank carries rhythm",
  },
  Cinematic: {
    summons: "brass + choir + timpani",
    fix: "chamber arrangement, no choir",
  },
  Orchestral: { summons: "choir", fix: "no choir" },
  "Classic rock": { summons: "guitar solos", fix: "no guitar solo" },
  "Deep house": {
    summons: "harsh screech leads",
    fix: "warm plucks, controlled highs",
  },
  Trap: {
    summons: "ad-libs, background shouts",
    fix: "single lead vocal only, no ad-libs",
  },
  "Boom bap": { summons: "ad-libs", fix: "single lead vocal only" },
};

// --- Contradiction pairs (Failure mode #1). Matched on whole words. --------

export const CONTRADICTIONS = [
  ["calm", "aggressive"],
  ["peaceful", "aggressive"],
  ["serene", "intense"],
  ["upbeat", "sad"],
  ["minimalist", "complex"],
  ["minimal", "orchestral"],
  ["soft", "shouty"],
  ["mellow", "brutal"],
  ["lo-fi", "studio quality"],
  ["fast", "melancholic"],
  ["no vocals", "female vocals"],
  ["no vocals", "male vocals"],
  ["instrumental only", "female vocals"],
  ["instrumental only", "male vocals"],
];

// Evaluative words that carry no sonic information (Failure mode #4).
export const EMPTY_WORDS = [
  "beautiful",
  "amazing",
  "emotional",
  "powerful",
  "perfect",
  "great",
  "incredible",
  "awesome",
  "epic",
  "nice",
  "good",
];

// --- Artist -> safe descriptor translations (NEVER emit the name) ----------
// Keyed loosely; the generator also asks Claude to decompose any artist not listed here.

export const ARTIST_TRANSLATIONS = [
  {
    match: ["beatles", "british invasion"],
    prompt:
      "1960s British pop-rock, jangly electric guitar, bass-driven rhythm section, bright snare, tight male vocal harmonies, melodic and upbeat, light reverb, mono warmth",
  },
  {
    match: ["motown", "supremes", "temptations"],
    prompt:
      "1960s Motown soul, mid-tempo, punchy horn section, tambourine backbeat, warm electric bass, joyful, rich vocals with call-and-response backing",
  },
  {
    match: ["depeche mode", "new order", "80s synth"],
    prompt:
      "1980s synth-pop, mid-tempo, analog synth arpeggios, gated reverb drums, melancholic, smooth emotive male vocals with lush reverb, atmospheric neon",
  },
  {
    match: ["nirvana", "soundgarden", "grunge"],
    prompt:
      "early 1990s grunge, distorted downtuned guitars, loose heavy drums, melodic bass, angsty and raw, strained male vocals, lo-fi garage, quiet-loud-quiet dynamic",
  },
  {
    match: ["nas", "biggie", "boom bap"],
    prompt:
      "1990s boom-bap hip-hop, 90 BPM, dusty vinyl drum break, warm jazz piano sample, deep upright bass, laid-back nostalgic, confident relaxed male rap, vinyl warmth",
  },
  {
    match: ["soccer mommy", "car seat headrest", "bedroom pop"],
    prompt:
      "2010s bedroom pop, slow tempo, soft clean electric guitar, mellow drum machine, hazy synth pads, dreamy introspective, breathy close-mic female vocals, lo-fi intimate warmth",
  },
  {
    match: ["drake", "toronto"],
    prompt:
      "atmospheric trap, moody R&B, melodic male vocals, conversational rap delivery, vulnerable and introspective, 808 bass, reverb-heavy pads, minimal piano, dark and polished, 78 BPM",
  },
  {
    match: ["billie eilish"],
    prompt:
      "dark pop, minimalist, breathy whispered female vocals, ASMR-intimate delivery, sub-bass, sparse electronic production, industrial textures, reverb-drenched, moody, 70 BPM",
  },
  {
    match: ["tame impala"],
    prompt:
      "neo-psychedelia, phaser-drenched guitars, analog synth arpeggios, heavily processed male vocals, reverb and delay wash, 70s-inspired but modern, dreamy and hypnotic, 110 BPM",
  },
  {
    match: ["travis scott"],
    prompt:
      "psychedelic trap, auto-tuned male vocals, ambient 808s, dark atmospheric production, layered distorted sound design, cinematic scale",
  },
  {
    match: ["kendrick", "conscious"],
    prompt:
      "conscious hip-hop, complex lyrical flow, jazz-influenced beats, West-Coast production, storytelling rap, introspective and politically aware, warm analog, boom-bap roots",
  },
  {
    match: ["phoebe bridgers", "sad indie"],
    prompt:
      "indie folk, slow and sparse, fingerpicked acoustic guitar, soft cello undertones, intimate breathy female vocals with slight rasp, raw and vulnerable, close-mic, lo-fi warmth, 68 BPM",
  },
];

// --- Vibe -> structured prompt seeds ---------------------------------------

export const VIBE_SEEDS = [
  {
    match: ["late night drive", "nostalgic drive", "night drive"],
    prompt:
      "dark ambient R&B, 72 BPM, warm synth pads, slow rolling bass, reverb-drenched minimal piano, conversational melancholic male vocals, late-night city feel, intimate and atmospheric",
  },
  {
    match: ["heartbreak", "breakup", "empty apartment"],
    prompt:
      "indie folk, slow and sparse, 65 BPM, fingerpicked acoustic guitar, soft cello undertones, intimate female vocals with slight rasp, raw and vulnerable, close-mic, lo-fi warmth",
  },
  {
    match: ["festival", "sunrise", "euphoric", "rave"],
    prompt:
      "uplifting progressive house, 124 BPM, shimmering synth pads, four-on-the-floor kick, rolling bass, melodic plucks, long tension build to cathartic release, fully instrumental",
  },
  {
    match: ["road trip", "summer", "friends"],
    prompt:
      "indie pop, upbeat and carefree, 105 BPM, jangly electric guitar, warm punchy drums, bright synth accents, harmonized female chorus, summer nostalgia, wide-open feeling",
  },
  {
    match: ["coffee", "morning", "alone", "cozy"],
    prompt:
      "lo-fi bedroom jazz, 78 BPM, soft upright bass, brushed snare, muted piano, distant muted trumpet, melancholic and warm, dusty vinyl, fully instrumental",
  },
  {
    match: ["comeback", "defiant", "fight", "anthem"],
    prompt:
      "arena rock, 128 BPM, distorted power chords, driving bass, stadium drums with room reverb, belting powerful male vocals, determined and raw, anthemic chorus, synth swell",
  },
  {
    match: ["grief", "loss", "funeral", "winter"],
    prompt:
      "orchestral ballad, 55 BPM, string quartet, solo piano, sparse, gentle restrained baritone, quiet grief, no percussion, winter desolation, long silences",
  },
];

// Soft limits used by the builder/validator.
export const STYLE_SOFT_LIMIT = 200; // chars — warn only, never block
export const DESCRIPTOR_MIN = 6;
export const DESCRIPTOR_MAX = 12;
