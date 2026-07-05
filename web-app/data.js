// data.js — Suno prompt vocabularies + preset library
// Sourced from the Musci.io "Suno Prompts: 100+ Examples" guide (2026).
// Everything here is read-only reference data; the app never mutates it.

// ---------------------------------------------------------------------------
// Component vocabularies (the 4-component structure)
// ---------------------------------------------------------------------------

const GENRES = [
  "Pop",
  "Pop-rock",
  "Indie pop",
  "Dark pop",
  "Synth-pop",
  "Electropop",
  "Acoustic pop",
  "Chamber pop",
  "Pop punk",
  "K-pop",
  "Classic rock",
  "Indie rock",
  "Progressive rock",
  "Grunge",
  "Blues rock",
  "Hard rock",
  "Alternative rock",
  "Surf rock",
  "Psychedelic rock",
  "Post-punk",
  "Southern rock",
  "Stoner rock",
  "Boom bap",
  "Trap",
  "Lo-fi hip-hop",
  "Conscious rap",
  "Drill",
  "G-funk",
  "Cloud rap",
  "Jazz rap",
  "Melodic rap",
  "Deep house",
  "Synthwave",
  "Techno",
  "Drum and bass",
  "Trance",
  "Dubstep",
  "Ambient electronic",
  "Future bass",
  "Chillwave",
  "Progressive house",
  "IDM",
  "Bebop",
  "Smooth jazz",
  "Jazz fusion",
  "Bossa nova",
  "Cool jazz",
  "Big band swing",
  "Modal jazz",
  "Vocal jazz",
  "Orchestral",
  "Baroque",
  "Romantic piano",
  "String quartet",
  "Minimalist classical",
  "Neoclassical",
  "Opera",
  "Choral",
  "Chillhop",
  "Vaporwave",
  "Lo-fi R&B",
  "Modern country",
  "Outlaw country",
  "Country pop",
  "Bluegrass",
  "Americana",
  "Honky-tonk",
  "Country rock",
  "Alt-country",
  "Neo-soul",
  "Alternative R&B",
  "Classic soul",
  "Trap soul",
  "Quiet storm",
  "Heavy metal",
  "Death metal",
  "Thrash metal",
  "Black metal",
  "Metalcore",
  "Progressive metal",
  "Doom metal",
  "Nu-metal",
  "Power metal",
  "Sludge metal",
];

const ERAS = [
  "1940s",
  "1950s",
  "1960s",
  "1970s",
  "1980s",
  "1985",
  "1990s",
  "2000s",
  "2010s",
  "2020s",
  "retrofuturistic",
  "vintage",
  "modern",
];

// Moods grouped by emotional family (the guide's "evocative words")
const MOODS = {
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

// Instruments + production grouped by category
const INSTRUMENTS = {
  Electronic: [
    "analog synthesizers",
    "drum machine",
    "808s",
    "pulsing synths",
    "soaring lead synth",
    "vocoder",
    "arpeggios",
  ],
  Traditional: [
    "acoustic guitar",
    "distorted guitars",
    "jangly guitars",
    "piano",
    "strings",
    "brass section",
    "saxophone",
    "fiddle",
    "pedal steel",
    "upright bass",
  ],
  Production: [
    "lo-fi textures",
    "vinyl crackle",
    "reverb-drenched",
    "clean mix",
    "tape saturation",
    "bedroom production",
    "polished production",
    "wide stereo",
  ],
  Texture: [
    "warm pads",
    "gritty bass",
    "liquid melodic",
    "fuzzy tone",
    "hypnotic rhythms",
    "4-on-the-floor",
    "driving rhythm",
    "walking bass",
  ],
};

// Vocal descriptors grouped (gender / delivery / style)
const VOCALS = {
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
    "powerful",
    "whispered",
    "raw",
    "raspy",
    "belting",
    "soft",
    "shouty",
    "autotuned",
  ],
  Style: [
    "folk storytelling",
    "operatic",
    "R&B",
    "rapping",
    "scatting",
    "spoken word",
    "confessional",
    "harmonized",
  ],
};

// ---------------------------------------------------------------------------
// Lyrics field tags (go inside the SEPARATE lyrics field, not the style prompt)
// ---------------------------------------------------------------------------

const STRUCTURE_TAGS = [
  "Intro",
  "Verse",
  "Pre-Chorus",
  "Chorus",
  "Bridge",
  "Outro",
  "Instrumental",
  "Break",
  "Hook",
  "Interlude",
];

const VOICE_TAGS = [
  "Whispered vocals",
  "Falsetto",
  "Growling",
  "Belting",
  "Breathy",
  "Raspy",
  "Operatic",
  "Spoken word",
  "Rapping",
  "Scatting",
];

const DYNAMICS_TAGS = [
  "Soft-spoken",
  "Shouted",
  "Building intensity",
  "Fading vocals",
  "Echoing softly",
  "Harmonized",
];

// Common negative-prompt chips (Technique 4)
const NEGATIVES = [
  "no vocals",
  "instrumental only",
  "avoid autotune",
  "no acoustic instruments",
  "avoid modern production",
  "no male voices",
  "no female voices",
  "avoid bright sounds",
  "no fast tempos",
];

// ---------------------------------------------------------------------------
// Contradiction pairs — the guide's Mistake #3. Warn when both appear.
// ---------------------------------------------------------------------------

const CONTRADICTIONS = [
  ["calm", "aggressive"],
  ["peaceful", "aggressive"],
  ["serene", "intense"],
  ["upbeat", "sad"],
  ["minimalist", "complex"],
  ["minimal", "orchestral"],
  ["soft", "shouty"],
  ["mellow", "brutal"],
  ["no vocals", "female vocals"],
  ["no vocals", "male vocals"],
  ["instrumental only", "female vocals"],
  ["instrumental only", "male vocals"],
];

// ---------------------------------------------------------------------------
// Preset library — the 100+ tested examples, keyed by genre family.
// ---------------------------------------------------------------------------

const PRESETS = {
  Pop: [
    {
      p: "2020s pop, catchy hooks, female vocals, bright synths, danceable, summer vibes",
      d: "Modern chart-ready pop",
    },
    {
      p: "Pop-rock, angsty emotional, raw female vocals, guitar-driven confessions, Gen Z heartbreak",
      d: "Olivia Rodrigo style",
    },
    {
      p: "Bubblegum pop, playful, male vocals, upbeat tempo, 2000s nostalgia",
      d: "Early 2000s revival",
    },
    {
      p: "Dark pop, moody atmosphere, breathy female vocals, minimal production, introspective",
      d: "Billie Eilish influence",
    },
    {
      p: "Power pop, anthemic chorus, layered vocals, driving guitars, stadium energy",
      d: "Arena-ready pop rock",
    },
    {
      p: "Indie pop, dreamy, soft male vocals, jangly guitars, bedroom production",
      d: "Lo-fi indie aesthetic",
    },
    {
      p: "K-pop, energetic, mixed group vocals, dance break, polished production",
      d: "Korean pop style",
    },
    {
      p: "Electropop, futuristic, vocoder vocals, pulsing synths, club-ready",
      d: "Dance-oriented pop",
    },
    {
      p: "Acoustic pop, intimate, fingerpicked guitar, warm female vocals, confessional",
      d: "Singer-songwriter pop",
    },
    {
      p: "Tropical pop, upbeat, steel drums, island vibes, summer anthem",
      d: "Vacation energy",
    },
    {
      p: "Pop ballad, emotional crescendo, piano-driven, powerful female vocals, heartbreak",
      d: "Power ballad style",
    },
    {
      p: "Synth-pop, 1985 aesthetic, analog warmth, catchy melody, new wave influence",
      d: "Retro synth sound",
    },
    {
      p: "Pop punk, energetic, teenage angst, fast drums, shouty vocals",
      d: "Blink-182 era",
    },
    {
      p: "Chamber pop, orchestral arrangements, baroque influences, sophisticated",
      d: "Ornate pop sound",
    },
    {
      p: "Funk-pop blend, groovy rhythms, male vocals, danceable brass",
      d: "Bruno Mars influence",
    },
  ],
  Rock: [
    {
      p: "Classic rock, 1970s arena sound, powerful guitar riffs, raspy male vocals, epic solos",
      d: "Led Zeppelin era",
    },
    {
      p: "Indie rock, jangly guitars, understated vocals, 2000s revival, garage recording",
      d: "The Strokes style",
    },
    {
      p: "Progressive rock, theatrical, falsetto male vocals, orchestral rock, sci-fi themes",
      d: "Queen meets Muse",
    },
    {
      p: "Grunge, 1990s Seattle, distorted guitars, raw angst, lo-fi production",
      d: "Nirvana influence",
    },
    {
      p: "Blues rock, slide guitar, gritty male vocals, swampy groove, southern heat",
      d: "Black Keys vibe",
    },
    {
      p: "Hard rock, aggressive riffs, powerful drums, anthemic chorus, arena energy",
      d: "AC/DC style",
    },
    {
      p: "Alternative rock, atmospheric, layered guitars, introspective lyrics, 1990s aesthetic",
      d: "Radiohead influence",
    },
    {
      p: "Surf rock, reverb-drenched guitars, instrumental, 1960s California, beach party",
      d: "Dick Dale sound",
    },
    {
      p: "Psychedelic rock, trippy effects, swirling organs, experimental, 1960s",
      d: "Pink Floyd era",
    },
    {
      p: "Post-punk revival, angular guitars, baritone vocals, dark atmosphere, dance-rock",
      d: "Interpol style",
    },
    {
      p: "Southern rock, twangy guitars, organ, male harmonies, road trip energy",
      d: "Lynyrd Skynyrd vibe",
    },
    {
      p: "Stoner rock, fuzzy guitars, heavy groove, desert vibes, hypnotic",
      d: "Queens of the Stone Age",
    },
  ],
  "Hip-Hop": [
    {
      p: "Boom bap, old school hip-hop, jazz samples, storytelling flow, 1990s New York",
      d: "Golden era hip-hop",
    },
    {
      p: "Trap, heavy 808s, hi-hats, dark atmospheric, confident male vocals",
      d: "Modern Atlanta trap",
    },
    {
      p: "Lo-fi hip-hop, vinyl crackle, mellow beats, jazz piano, chill vibes, instrumental",
      d: "Study music",
    },
    {
      p: "Conscious rap, thoughtful lyrics, soulful samples, male vocals, socially aware",
      d: "Kendrick influence",
    },
    {
      p: "Drill, dark bass, sliding 808s, aggressive flow, UK influence",
      d: "Modern drill style",
    },
    {
      p: "West coast G-funk, smooth synths, laid-back groove, 1990s LA, funky",
      d: "Dr. Dre era",
    },
    {
      p: "Cloud rap, ethereal atmosphere, auto-tuned vocals, dreamlike, spacey production",
      d: "Travis Scott vibe",
    },
    {
      p: "Jazz rap, live instrumentation, complex flows, intellectual, sophisticated",
      d: "A Tribe Called Quest",
    },
    {
      p: "Southern hip-hop, bouncy beats, crunk energy, party anthem, call and response",
      d: "Dirty South style",
    },
    {
      p: "Alternative hip-hop, experimental beats, genre-bending, artistic, unconventional",
      d: "Tyler the Creator",
    },
    {
      p: "Melodic rap, singing-rapping hybrid, emotional, 808s, introspective hooks",
      d: "Drake influence",
    },
    {
      p: "Battle rap, aggressive delivery, complex rhyme schemes, competitive, raw",
      d: "Freestyle energy",
    },
  ],
  "Electronic/EDM": [
    {
      p: "Deep house, emotional, melodic synths, hypnotic rhythms, 4-on-the-floor, warm basslines",
      d: "Melodic house",
    },
    {
      p: "Synthwave, 1980s retrofuturism, analog synths, neon aesthetic, driving arpeggios",
      d: "Outrun style",
    },
    {
      p: "Techno, dark and industrial, pounding kick drums, minimal, Berlin club, relentless",
      d: "Underground techno",
    },
    {
      p: "Drum and bass, fast breaks, heavy sub-bass, liquid melodic, energetic",
      d: "Jungle influence",
    },
    {
      p: "Trance, euphoric, building energy, soaring synths, uplifting breakdown",
      d: "Classic trance",
    },
    {
      p: "Dubstep, heavy wobbles, aggressive drops, distorted bass, intense energy",
      d: "Skrillex era",
    },
    {
      p: "Ambient electronic, atmospheric pads, no drums, ethereal, meditative, wide stereo",
      d: "Brian Eno influence",
    },
    {
      p: "Future bass, colorful synths, chopped vocals, emotional drops, festival energy",
      d: "Flume style",
    },
    {
      p: "Chillwave, nostalgic synths, hazy vocals, lo-fi production, dreamy",
      d: "2010s aesthetic",
    },
    {
      p: "Progressive house, building tension, epic drops, melodic layers, festival anthem",
      d: "Swedish House Mafia",
    },
    {
      p: "IDM, glitchy beats, experimental sound design, complex rhythms, abstract",
      d: "Aphex Twin territory",
    },
    {
      p: "Electro, punchy drums, distorted basslines, robotic, 1980s influence",
      d: "Justice style",
    },
  ],
  Jazz: [
    {
      p: "Bebop, fast tempo, saxophone lead, walking bass, improvisational, 1950s New York",
      d: "Charlie Parker style",
    },
    {
      p: "Smooth jazz, mellow saxophone, electric piano, relaxed groove, late night",
      d: "Kenny G territory",
    },
    {
      p: "Jazz fusion, complex rhythms, electric guitar, funk influence, virtuosic",
      d: "Weather Report era",
    },
    {
      p: "Bossa nova, Brazilian rhythm, nylon guitar, warm bass, intimate atmosphere, 1960s elegance",
      d: "Jobim influence",
    },
    {
      p: "Cool jazz, laid-back, trumpet lead, subtle brush drums, sophisticated",
      d: "Miles Davis vibe",
    },
    {
      p: "Big band swing, brass section, energetic, dance floor, 1940s vintage",
      d: "Glenn Miller era",
    },
    {
      p: "Modal jazz, sparse arrangement, atmospheric, trumpet, minimalist exploration",
      d: "Kind of Blue style",
    },
    {
      p: "Jazz piano trio, intimate, upright bass, brush drums, classic standards",
      d: "Bill Evans feel",
    },
    {
      p: "Nu jazz, electronic elements, broken beats, modern production, experimental",
      d: "Contemporary fusion",
    },
    {
      p: "Vocal jazz, female singer, scatting, swinging rhythm, classic standards, sultry",
      d: "Ella Fitzgerald style",
    },
  ],
  Classical: [
    {
      p: "Orchestral, cinematic, full symphony, triumphant crescendo, film score",
      d: "Hans Zimmer style",
    },
    {
      p: "Baroque, harpsichord, string ensemble, ornate, 1700s, contrapuntal",
      d: "Bach influence",
    },
    {
      p: "Romantic piano, solo instrument, emotional, rubato, Chopin-inspired",
      d: "19th century piano",
    },
    {
      p: "String quartet, intimate, chamber music, emotional dialogue, classical form",
      d: "Beethoven quartets",
    },
    {
      p: "Minimalist classical, repetitive patterns, slowly evolving, meditative, modern",
      d: "Philip Glass style",
    },
    {
      p: "Orchestral trailer, epic percussion, brass fanfare, building intensity, heroic",
      d: "Two Steps From Hell",
    },
    {
      p: "Neoclassical, piano and strings, contemporary, emotional, cinematic ambient",
      d: "Nils Frahm influence",
    },
    {
      p: "Opera aria, soprano vocals, dramatic, Italian style, passionate",
      d: "Puccini grandeur",
    },
    {
      p: "Impressionist, dreamy, piano with orchestral color, subtle, Debussy-like",
      d: "French impressionism",
    },
    {
      p: "Choral, mixed voices, sacred atmosphere, reverberant, soaring harmonies",
      d: "Cathedral sound",
    },
  ],
  "Lo-Fi": [
    {
      p: "Lo-fi hip-hop, vinyl crackle, dusty samples, mellow beat, study music, instrumental",
      d: "Classic lo-fi",
    },
    {
      p: "Chillhop, jazzy samples, relaxed groove, tape hiss, coffee shop vibe",
      d: "Cozy atmosphere",
    },
    {
      p: "Lo-fi bedroom pop, hazy vocals, warped synths, intimate production, dreamy",
      d: "Bedroom recording",
    },
    {
      p: "Lo-fi jazz, soft piano, subtle drums, warm saturation, evening mood",
      d: "Jazz meets lo-fi",
    },
    {
      p: "Ambient lo-fi, spacey pads, minimal drums, wide reverb, floating",
      d: "Meditative lo-fi",
    },
    {
      p: "Lo-fi R&B, slow groove, pitched vocals, romantic, late night",
      d: "Soulful lo-fi",
    },
    {
      p: "Vaporwave, slowed samples, 1980s nostalgia, surreal, heavy reverb, lo-fi",
      d: "Aesthetic wave",
    },
    {
      p: "Lo-fi guitar, acoustic fingerpicking, tape warble, intimate, folk-influenced",
      d: "Organic lo-fi",
    },
    {
      p: "Rainy day lo-fi, rain sounds, soft beats, melancholic, cozy atmosphere",
      d: "Weather ambience",
    },
    {
      p: "Lo-fi synthwave, retro synths, tape saturation, nostalgic, warm analog",
      d: "80s meets lo-fi",
    },
  ],
  Country: [
    {
      p: "Modern country, male vocals, acoustic guitar, polished production, storytelling",
      d: "Nashville sound",
    },
    {
      p: "Outlaw country, gritty, raw male vocals, rebellious, 1970s influence",
      d: "Willie Nelson style",
    },
    {
      p: "Country pop, female vocals, catchy hooks, crossover appeal, upbeat",
      d: "Taylor Swift era",
    },
    {
      p: "Bluegrass, acoustic instruments, fast picking, harmonized vocals, Appalachian",
      d: "Traditional bluegrass",
    },
    {
      p: "Americana, rootsy, storytelling, acoustic, weathered vocals, authentic",
      d: "Folk-country blend",
    },
    {
      p: "Honky-tonk, upbeat, steel guitar, fiddle, dance floor energy, classic",
      d: "Vintage country",
    },
    {
      p: "Country rock, southern rock influence, electric guitars, driving rhythm",
      d: "Eagles territory",
    },
    {
      p: "Country ballad, emotional, pedal steel, slow tempo, heartbreak",
      d: "Tearjerker style",
    },
    {
      p: "Red dirt country, Texas influence, storytelling, authentic, independent spirit",
      d: "Texas country",
    },
    {
      p: "Alt-country, indie influence, unconventional production, thoughtful, literary",
      d: "Wilco style",
    },
  ],
  "R&B": [
    {
      p: "Modern R&B, smooth production, male falsetto, minimalist beats, sensual",
      d: "Frank Ocean influence",
    },
    {
      p: "90s R&B, new jack swing, layered harmonies, groovy, nostalgic",
      d: "Boyz II Men era",
    },
    {
      p: "Neo-soul, live instruments, warm bass, conscious lyrics, organic",
      d: "D'Angelo style",
    },
    {
      p: "Alternative R&B, experimental production, atmospheric, genre-bending",
      d: "The Weeknd territory",
    },
    {
      p: "Classic soul, 1960s Motown, horns, emotional, call and response",
      d: "Marvin Gaye influence",
    },
    {
      p: "Trap soul, 808s, moody atmosphere, auto-tuned vocals, late night",
      d: "Bryson Tiller style",
    },
    {
      p: "Gospel R&B, powerful vocals, spiritual, uplifting, choir harmonies",
      d: "Contemporary gospel",
    },
    {
      p: "Quiet storm, slow jams, romantic, smooth male vocals, intimate",
      d: "Luther Vandross vibe",
    },
    {
      p: "UK R&B, British influence, garage undertones, smooth, sophisticated",
      d: "British soul sound",
    },
    {
      p: "Funk-R&B, groovy basslines, syncopated rhythm, danceable, brass stabs",
      d: "Funk fusion",
    },
  ],
  Metal: [
    {
      p: "Heavy metal, powerful riffs, soaring vocals, epic solos, 1980s influence",
      d: "Iron Maiden style",
    },
    {
      p: "Death metal, blast beats, growled vocals, brutal, down-tuned guitars",
      d: "Extreme metal",
    },
    {
      p: "Thrash metal, fast tempo, aggressive riffs, angry vocals, mosh pit energy",
      d: "Metallica influence",
    },
    {
      p: "Black metal, tremolo picking, shrieked vocals, atmospheric, cold and dark",
      d: "Norwegian style",
    },
    {
      p: "Metalcore, heavy breakdowns, screamed and clean vocals, modern production",
      d: "Parkway Drive sound",
    },
    {
      p: "Progressive metal, complex time signatures, technical, concept album feel",
      d: "Dream Theater territory",
    },
    {
      p: "Doom metal, slow and heavy, crushing riffs, dark atmosphere, despair",
      d: "Black Sabbath influence",
    },
    {
      p: "Nu-metal, down-tuned, DJ scratches, rap-influenced vocals, 2000s era",
      d: "Linkin Park style",
    },
    {
      p: "Power metal, fast and melodic, epic themes, soaring vocals, symphonic",
      d: "Fantasy metal",
    },
    {
      p: "Sludge metal, thick fuzzy tone, groovy and heavy, swampy, southern",
      d: "Mastodon influence",
    },
  ],
};

const STYLE_CHAR_LIMIT = 200; // Suno style field soft cap
const DESCRIPTOR_MIN = 4; // sweet-spot floor
const DESCRIPTOR_MAX = 7; // sweet-spot ceiling
