// album-generator.js — two-phase album generation. Pure logic + Anthropic calls.
// planAlbum() designs the record's shared sonic identity (soundDNA) + a tracklist;
// generateAlbumTrack() expands one track into a full Suno prompt that sits inside
// that identity. Distinct from set-generator: NO energy arc / BPM policy / DJ
// framing — an album is one artist's cohesive record. fetchFn is injectable.
import { DEFAULT_MODEL } from "./constants.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Cohesive roles cycle so an offline plan still reads like a sequenced record.
const COHESIVE_ROLES = [
  "opener",
  "single",
  "deep cut",
  "single",
  "interlude",
  "deep cut",
  "single",
  "deep cut",
  "penultimate",
  "closer",
];

export function clampCount(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 10;
  return Math.max(3, Math.min(20, v));
}

function clampPct(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return "";
  return String(Math.max(0, Math.min(100, n)));
}

const VOCAL_GENDERS = new Set(["female", "male", "duet", "any"]);

function extractJson(text) {
  if (!text) throw new Error("empty response");
  const fenced = text.replace(/```json\s*/gi, "").replace(/```/g, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start)
    throw new Error("no JSON object found");
  return JSON.parse(fenced.slice(start, end + 1));
}

async function callClaude({
  apiKey,
  model,
  system,
  userMessage,
  fetchFn,
  maxTokens = 2048,
  strict = false,
}) {
  const doFetch = fetchFn || fetch;
  const messages = [{ role: "user", content: userMessage }];
  if (strict) messages.push({ role: "assistant", content: "{" });
  const res = await doFetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const map = {
      401: "Invalid API key — check it in Settings.",
      429: "Rate limited — wait and retry.",
    };
    throw new Error(
      map[res.status] ||
        `Anthropic API error ${res.status}: ${String(detail).slice(0, 160)}`,
    );
  }
  const data = await res.json();
  let text = (data.content || []).map((b) => b.text || "").join("");
  if (strict && !text.trimStart().startsWith("{")) text = `{${text}`;
  return text;
}

const PLAN_SYSTEM = `You are a world-class A&R + record producer. Design a COHESIVE ALBUM — NOT a DJ set (no energy arc, no beatmatching, no mixing). Given a seed vibe or artist-style reference, define ONE consistent sonic identity and a sequenced tracklist of songs that all sound like the same artist yet are distinct songs.
RULES:
- If the seed is an ARTIST reference, DECOMPOSE it into descriptors (era+production, genre/subgenre, signature instruments, generic vocal character). NEVER emit the artist's name anywhere.
- "soundDNA" is the shared palette every track builds on: genre/subgenre first, era/production package, 2–3 signature instruments, vocal character. Keep it tight (~120 chars).
- COHESIVE mode: tracks VARY in tempo, mood, and subject but all live inside the soundDNA. Give each a role (opener / single / deep cut / interlude / closer) and a distinct angle (its subject + how its tempo/mood differs). Sequence like a real record.
- CONCEPT mode: the album tells ONE story/theme; each track is the next chapter IN ORDER, its angle is that beat of the narrative. Still one soundDNA.
- Every track needs a distinct trackTitle. Never reuse a title. Never make medical/therapeutic claims.
OUTPUT ONLY JSON: {"albumTitle":"...","soundDNA":"shared style descriptors, genre first","exclude":"album-wide exclude list or empty","tracks":[{"trackTitle":"...","role":"opener|single|deep cut|interlude|closer|chapter","angle":"subject + tempo/mood variation for THIS track"}]}`;

export const TRACK_SYSTEM = `You are a world-class Suno prompt engineer AND lyricist. Expand ONE album track into a Suno prompt. The album's shared soundDNA is given: the track's style MUST sit inside that identity (same genre/era/production/vocal character) so the record coheres — while honoring THIS track's angle (its own tempo, mood, subject). Genre first, 6–12 descriptors, front-loaded, includes a BPM + vocal spec.
Write full, specific, non-cliché lyrics on the track's angle/subject using [Section] tags; if a MOMENTARY production/FX effect helps a line, WRITE the inline tag ([Vocal Chop], [Harmonies], etc.) directly into the lyrics — the field must be paste-ready. VOCAL DELIVERY: the STYLE field is the reliable lever — put delivery there, described per section (e.g. "breathy intimate verses building to a belted chorus, stripped whispered bridge"). In the LYRICS, the ONLY reliable per-section cue is a SHORT parenthetical on its OWN line, sitting between the plain section tag and the lyric lines — i.e. [Bridge] on its own line, then (whispered) alone on the next line, then the clean lyric lines. NEVER put a second bracket after a section tag — [Verse] [Soft, Intimate] gets SUNG out loud as lyrics. NEVER glue the cue onto a lyric line, and NEVER put lyric words inside brackets. Keep section tags plain ([Verse] / [Chorus] / [Bridge]); use at most 2–3 cues per song (the bridge is the highest-value spot). A true whisper also needs that section kept sparse in the style — Suno won't whisper over a wall of sound. LYRIC CRAFT: keep lines even (each within ±2 syllables of the others, or Suno rushes/glitches); favor ABAB + slant / near rhymes over sing-song AABB perfect rhymes; keep the chorus short and repeat its exact text; respell tricky words, NAMES, and numbers phonetically (Evie→Ee-vee, 2am→three A-M). Never emit numeric/parameter tags like [Reverb: 30%] (proven placebo) — use words (reverb-drenched). Never emit artist names, empty evaluative words, or medical claims.
OUTPUT ONLY JSON: {"title":"...","style":"...","exclude":"...","bpm":"92","vocalGender":"female|male|duet|any","weirdness":20,"styleInfluence":60,"lyrics":"full lyrics with [Section] tags","notes":"one concrete do-it-now sentence, or empty string"}`;

function seedLine(seed, seedMode) {
  const clean = String(seed || "").trim();
  return seedMode === "artist"
    ? `SEED — an ARTIST/STYLE reference (decompose, never name): "${clean}"`
    : `SEED — a vibe/feeling: "${clean}"`;
}

export async function planAlbum({
  seed,
  seedMode = "vibe",
  mode = "cohesive",
  trackCount,
  apiKey,
  model = DEFAULT_MODEL,
  fetchFn,
}) {
  const count = clampCount(trackCount);
  if (!apiKey)
    return {
      ...offlineAlbumPlan(seed, seedMode, mode, count),
      offline: true,
      offlineNote:
        "PREVIEW ONLY — no API key, so this is a rough offline outline (no real AI). Add a key in ⚙ Settings, then re-plan.",
    };
  const modeLine =
    mode === "concept"
      ? `MODE: CONCEPT ALBUM — one story across all ${count} tracks, each the next chapter in order.`
      : `MODE: COHESIVE RECORD — ${count} distinct songs sharing one sound, artistically sequenced.`;
  const userMessage = `${seedLine(seed, seedMode)}
${modeLine}
TRACK COUNT: ${count} — output EXACTLY ${count} tracks.`;
  try {
    const obj = extractJson(
      await callClaude({
        apiKey,
        model,
        system: PLAN_SYSTEM,
        userMessage,
        fetchFn,
        maxTokens: 3072,
      }),
    );
    // Require the exact track count on the first pass; a short list falls through
    // to the strict retry (which gives the model a second chance to hit it).
    if (!Array.isArray(obj.tracks) || obj.tracks.length !== count)
      throw new Error("bad shape");
    return normalizeAlbumPlan(obj, seed, seedMode, mode, count);
  } catch (err) {
    if (/API key|Rate limited|API error/.test(err.message))
      return {
        ...offlineAlbumPlan(seed, seedMode, mode, count),
        offline: true,
        offlineNote: `${err.message} Showing a rough offline outline.`,
      };
    try {
      const obj = extractJson(
        await callClaude({
          apiKey,
          model,
          system: PLAN_SYSTEM,
          userMessage,
          fetchFn,
          maxTokens: 3072,
          strict: true,
        }),
      );
      if (!Array.isArray(obj.tracks) || !obj.tracks.length)
        throw new Error("bad shape");
      return normalizeAlbumPlan(obj, seed, seedMode, mode, count);
    } catch {
      return {
        ...offlineAlbumPlan(seed, seedMode, mode, count),
        offline: true,
        offlineNote:
          "PREVIEW ONLY — the AI response was unparseable; showing a rough offline outline. Try Re-plan.",
      };
    }
  }
}

function normalizeAlbumPlan(obj, seed, seedMode, mode, count) {
  const tracks = obj.tracks.slice(0, count).map((t, i) => ({
    trackTitle: String(t.trackTitle || `Track ${i + 1}`).trim(),
    role: String(
      t.role || (mode === "concept" ? "chapter" : "deep cut"),
    ).trim(),
    angle: String(t.angle || "").trim(),
  }));
  // Never fall back to a raw ARTIST seed as the title (Suno policy) — only a vibe
  // seed is safe to reuse if the model omitted albumTitle.
  const titleFallback = seedMode === "artist" ? "" : seed;
  return {
    albumTitle: String(obj.albumTitle || titleFallback || "Untitled album")
      .trim()
      .slice(0, 60),
    soundDNA: String(obj.soundDNA || "").trim(),
    exclude: String(obj.exclude || "").trim(),
    tracks,
  };
}

// Offline outline — no AI. Derives a rough soundDNA from the seed and lays out N
// titled slots with cycling roles so the flow is visible before a key is set.
export function offlineAlbumPlan(seed, seedMode, mode, trackCount) {
  const count = clampCount(trackCount);
  const clean = String(seed || "").trim();
  const soundDNA =
    seedMode === "artist"
      ? "modern production, defining instrumentation, generic vocal character, consistent mood"
      : `indie sound built around: ${clean.slice(0, 80)}`;
  const tracks = Array.from({ length: count }, (_, i) => ({
    trackTitle: `Track ${i + 1}`,
    role:
      mode === "concept"
        ? `chapter ${i + 1}`
        : COHESIVE_ROLES[i] ||
          (i === count - 1 ? "closer" : i === 0 ? "opener" : "deep cut"),
    angle: "",
  }));
  return {
    // NEVER surface a raw artist seed as the title (Suno policy — same reason
    // soundDNA is decomposed above). Vibe seeds are safe to reuse as a title.
    albumTitle: (seedMode === "artist"
      ? "Untitled album"
      : clean || "Untitled album"
    ).slice(0, 60),
    soundDNA,
    exclude: "",
    tracks,
  };
}

function normalizeAlbumTrack(obj) {
  const gender = String(obj.vocalGender || "")
    .trim()
    .toLowerCase();
  return {
    title: String(obj.title || "").trim(),
    style: String(obj.style || "")
      .trim()
      .slice(0, 200),
    exclude: String(obj.exclude || "").trim(),
    bpm: String(obj.bpm || "").trim(),
    vocalGender: VOCAL_GENDERS.has(gender) ? gender : "",
    weirdness: clampPct(obj.weirdness),
    styleInfluence: clampPct(obj.styleInfluence),
    lyrics: String(obj.lyrics || "").trim(),
    notes: String(obj.notes || "").trim(),
  };
}

export async function generateAlbumTrack({
  album,
  brief,
  apiKey,
  model = DEFAULT_MODEL,
  fetchFn,
}) {
  if (!apiKey) return offlineAlbumTrack(album, brief);
  const userMessage = `ALBUM soundDNA (every track shares this identity): ${album.soundDNA}
ALBUM-WIDE EXCLUDE: ${album.exclude || "(none)"}
MODE: ${album.mode === "concept" ? "concept album (this track is a chapter of the story)" : "cohesive record"}
THIS TRACK — title: "${brief.trackTitle}"; role: ${brief.role}; angle: ${brief.angle || "(develop from the soundDNA)"}
Write the Suno prompt for THIS track, keeping it inside the album's sound.`;
  try {
    return normalizeAlbumTrack(
      extractJson(
        await callClaude({
          apiKey,
          model,
          system: TRACK_SYSTEM,
          userMessage,
          fetchFn,
          maxTokens: 2048,
        }),
      ),
    );
  } catch (err) {
    if (/API key|Rate limited|API error/.test(err.message))
      return offlineAlbumTrack(album, brief);
    try {
      return normalizeAlbumTrack(
        extractJson(
          await callClaude({
            apiKey,
            model,
            system: TRACK_SYSTEM,
            userMessage,
            fetchFn,
            maxTokens: 2048,
            strict: true,
          }),
        ),
      );
    } catch {
      return offlineAlbumTrack(album, brief);
    }
  }
}

// Offline track — no AI, so no real lyrics. Style = the album's soundDNA (that's
// the whole point: cohesion), title from the planned slot.
export function offlineAlbumTrack(album, brief) {
  return {
    title: brief.trackTitle || "Untitled",
    style: String(album.soundDNA || "").slice(0, 200),
    exclude: album.exclude || "",
    bpm: "",
    vocalGender: "",
    weirdness: "20",
    styleInfluence: "60",
    lyrics: "(set your API key to auto-write this track's lyrics)",
    notes: "",
  };
}
