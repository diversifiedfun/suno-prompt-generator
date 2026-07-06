// generator.js — turns a vibe/feeling or artist/style into a dialed-in Suno prompt.
// Pure logic, no DOM. Calls the Anthropic API directly from the side panel page
// (browser access header verified per docs/suno-prompt-learnings.md sources).
import { ARTIST_TRANSLATIONS, VIBE_SEEDS, GENRE_TRAPS } from "./knowledge.js";
import { DEFAULT_MODEL } from "./constants.js";

export { DEFAULT_MODEL };
export const MODELS = [
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6 — best quality (recommended)" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — faster & cheaper" },
];

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// The system prompt IS the research catalog, compressed into operating rules.
export const SYSTEM_PROMPT = `You are a world-class Suno AI music prompt engineer. You turn a user's vibe, feeling, or artist/style reference into a Suno prompt that reliably produces a great song on Suno v4.5/v5.5.

NON-NEGOTIABLE RULES (from tested research):
1. Two separate fields. STYLE field = genre, era, mood, instruments, tempo, vocal type. LYRICS field = words + [Section] tags. Never mix them.
2. Genre goes FIRST in the style prompt — leading tokens get the most weight.
3. Use 6–12 high-signal descriptors. Under 5 = generic; over 15 = the model ignores later tokens and contradicts itself.
4. ALWAYS anchor a BPM and ALWAYS give a 3-layer vocal spec (character + delivery + effect), unless the song is instrumental.
5. Era is a production package (1970s=analog warmth, 1980s=gated reverb+drum machines, 2010s=hyper-compression). Pick one deliberately.
6. Translate FEELINGS into a concrete scene + instrumentation + production texture. Never use empty evaluative words (beautiful, amazing, emotional, powerful, epic) — they carry zero sonic information.
7. ARTIST NAMES ARE BANNED. Suno filters them and flags impersonation. If the user names an artist, DECOMPOSE them into: era+production, genre/subgenre, 2–3 defining instruments, GENERIC vocal character, mood+rhythmic feel. Never emit the artist's name in any field.
8. Negatives are guidance, not bans. Put them in the Exclude field. Max ~2 exclusions, each paired with a replacement. Watch genre default-traps (gospel→choir, reggae→skank guitar, EDM→harsh leads, rap→ad-libs, orchestral→choir).
9. Avoid contradictions (lo-fi+studio quality, minimal+orchestral, aggressive+peaceful).
10. Keep the style prompt tight (aim ~200 chars, front-loaded). Detail belongs in the structure scaffold.
11. ALWAYS return a "title": an evocative 2–5 word song title that fits the vibe (never an artist name, never generic like "Untitled").
12. LYRICS: If the user gives a SUBJECT (what the song is about), WRITE full, specific, non-cliché lyrics in the "lyrics" field — real verses plus a chorus built around that subject, using [Section] tags. If NO subject is given, return "lyrics" as an empty string and rely on the structure scaffold instead. Never emit an artist's name in the lyrics. If a production/vocal effect would help a specific line, WRITE the inline tag directly into the lyrics at that spot (e.g. [Vocal Chop], [Stutter], [Whisper], [Belt], [Spoken], [Harmonies]) — do NOT tell the user to add it; the lyrics field must be paste-ready as-is.
13. VOCAL GENDER: unless the song is instrumental, decide the singer and return "vocalGender" as exactly one of "female", "male", "duet", or "any". Put the matching vocal descriptor in the style too (e.g. "breathy female vocals").
14. SUNO SLIDERS: recommend two 0–100 values. "weirdness" = how experimental/unexpected (low 10–25 for clean radio-ready, mid 30–50 for character, high 60+ for glitchy/odd). "styleInfluence" = how hard Suno hugs the style prompt (higher 55–75 = closer to the described genre/era, lower 30–45 = looser/more creative). Pick deliberately for THIS song, not defaults.
15. NOTES: "notes" is ONE short, concrete, do-it-now sentence. It must NOT hedge ("if Suno supports it", "keep regenerating until…"), must NOT tell the user to add tags (bake those into the lyrics instead per rule 12), and must NOT restate the style or lyrics. If there is nothing genuinely useful and specific to add, return an empty string.

OUTPUT CONTRACT — return ONLY a JSON object, no prose, no markdown fences:
{
  "title": "an evocative 2–5 word song title (never an artist name)",
  "style": "the Style-of-Music field, genre first, 6–12 descriptors, includes BPM + vocal spec",
  "exclude": "comma list for Suno's Exclude field, or empty string",
  "bpm": "e.g. 92",
  "vocalGender": "female | male | duet | any",
  "weirdness": 20,
  "styleInfluence": 60,
  "structure": "a LYRICS-field scaffold using [Intro]/[Verse]/[Chorus]/[Bridge]/[Outro] tags with brief functional cues in parentheses; no actual lyrics",
  "lyrics": "full lyrics with [Section] tags when a SUBJECT is given; otherwise an empty string",
  "notes": "one concrete do-it-now sentence, or empty string — no hedging, no 'add this tag', no restating style/lyrics",
  "variants": ["one alternate style prompt taking a different angle"]
}`;

export function buildUserMessage(mode, input, subject = "") {
  const clean = String(input || "").trim();
  const subj = String(subject || "").trim();
  const subjectLine = subj
    ? ` The song is ABOUT: "${subj}" — write full lyrics on this subject in the lyrics field.`
    : "";
  if (mode === "artist") {
    return `The user wants a song that sounds like: "${clean}".${subjectLine} Decompose this artist/style into safe descriptors (never name them) and produce the Suno prompt JSON.`;
  }
  if (mode === "refine") {
    return `Improve this existing Suno style prompt — fix weak spots per your rules, keep its intent: "${clean}".${subjectLine} Produce the Suno prompt JSON.`;
  }
  return `The user described this vibe/feeling: "${clean}".${subjectLine} Produce the Suno prompt JSON.`;
}

// Tolerant JSON extraction — strips fences/prose, grabs the outermost object.
function extractJson(text) {
  if (!text) throw new Error("empty response");
  const fenced = text.replace(/```json\s*/gi, "").replace(/```/g, "");
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start)
    throw new Error("no JSON object found");
  return JSON.parse(fenced.slice(start, end + 1));
}

// Clamp a slider recommendation to an integer 0–100; empty string if unusable.
function clampPct(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return "";
  return String(Math.max(0, Math.min(100, n)));
}

const VOCAL_GENDERS = new Set(["female", "male", "duet", "any"]);

function normalize(obj) {
  const gender = String(obj.vocalGender || "")
    .trim()
    .toLowerCase();
  return {
    title: String(obj.title || "").trim(),
    style: String(obj.style || "").trim(),
    exclude: String(obj.exclude || "").trim(),
    bpm: String(obj.bpm || "").trim(),
    vocalGender: VOCAL_GENDERS.has(gender) ? gender : "",
    weirdness: clampPct(obj.weirdness),
    styleInfluence: clampPct(obj.styleInfluence),
    structure: String(obj.structure || "").trim(),
    lyrics: String(obj.lyrics || "").trim(),
    notes: String(obj.notes || "").trim(),
    variants: Array.isArray(obj.variants)
      ? obj.variants.map((v) => String(v).trim()).filter(Boolean)
      : [],
    fallback: false,
  };
}

async function callClaude(apiKey, model, userMessage, strict) {
  const messages = [{ role: "user", content: userMessage }];
  if (strict) messages.push({ role: "assistant", content: "{" });
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      // Full lyrics (when a subject is given) + title + style + structure +
      // variants overrun 800 tokens and truncate the JSON mid-string, which then
      // fails to parse and silently falls back to offline. 2048 matches the
      // set generator's lyric-bearing track call and leaves ample room.
      model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const map = {
      401: "Invalid API key — check it in Settings.",
      429: "Rate limited — wait a moment and retry.",
    };
    throw new Error(
      map[res.status] ||
        `Anthropic API error ${res.status}: ${detail.slice(0, 160)}`,
    );
  }
  const data = await res.json();
  let text = (data.content || []).map((b) => b.text || "").join("");
  if (strict) text = `{${text}`; // re-attach the prefilled brace
  return text;
}

// Main entry. Returns a normalized result; falls back to offline seeds on any failure.
export async function generatePrompt({
  mode,
  input,
  subject = "",
  apiKey,
  model = DEFAULT_MODEL,
}) {
  if (!String(input || "").trim())
    throw new Error("Describe a vibe or an artist first.");
  if (!apiKey)
    return {
      ...offlineGenerate(mode, input, subject),
      notes:
        "No API key set — used the offline library. Add your Anthropic key in Settings for full AI generation.",
    };

  const userMessage = buildUserMessage(mode, input, subject);
  try {
    return normalize(extractJson(await callClaude(apiKey, model, userMessage)));
  } catch (firstErr) {
    if (/API key|Rate limited|API error/.test(firstErr.message)) {
      // Real API/network problem — surface it rather than silently masking.
      const fb = offlineGenerate(mode, input, subject);
      return {
        ...fb,
        notes: `${firstErr.message} Showing an offline suggestion instead.`,
      };
    }
    // Parse problem — retry once in strict JSON-prefill mode.
    try {
      return normalize(
        extractJson(await callClaude(apiKey, model, userMessage, true)),
      );
    } catch {
      const fb = offlineGenerate(mode, input, subject);
      return {
        ...fb,
        notes:
          "AI response was unparseable twice — used the offline library instead.",
      };
    }
  }
}

// Offline fallback using the curated seed maps. Never throws. Offline can't write
// real lyrics, so `lyrics` stays empty even when a subject is given; the title is
// a light derivation from the subject or vibe so the field is never blank.
export function offlineGenerate(mode, input, subject = "") {
  const q = String(input || "").toLowerCase();
  const table = mode === "artist" ? ARTIST_TRANSLATIONS : VIBE_SEEDS;
  const hit = table.find((row) => row.match.some((m) => q.includes(m)));
  const style = hit ? hit.prompt : seedFromKeywords(mode, q);
  const trapKey = Object.keys(GENRE_TRAPS).find((g) =>
    style.toLowerCase().includes(g.toLowerCase()),
  );
  // Derive gender from the seed style text when it says so, else leave it open.
  const lowerStyle = style.toLowerCase();
  const vocalGender = /\bfemale\b/.test(lowerStyle)
    ? "female"
    : /\bmale\b/.test(lowerStyle)
      ? "male"
      : "";
  return {
    title: offlineTitle(subject, input),
    style,
    exclude: trapKey ? GENRE_TRAPS[trapKey].fix : "",
    bpm: (style.match(/(\d{2,3})\s*bpm/i) || [])[1] || "",
    vocalGender,
    weirdness: "20",
    styleInfluence: "60",
    structure:
      "[Intro] (set the mood, 4 bars)\n[Verse] (intimate, minimal)\n[Pre-Chorus] (build tension)\n[Chorus] (full energy, the hook)\n[Verse]\n[Chorus]\n[Bridge] (left turn, strip back)\n[Outro] (resolve / fade)",
    lyrics: "",
    notes: hit
      ? "Starting point from the offline library — generate 3–5 variations on Suno and iterate."
      : "Generic scaffold — set your API key for a tailored prompt.",
    variants: [],
    fallback: true,
  };
}

// A light Title-Case title from the subject (preferred) or vibe text — first few
// words, no trailing punctuation. Falls back to "Untitled" only if both empty.
export function offlineTitle(subject, input) {
  const src = String(subject || input || "").trim();
  if (!src) return "Untitled";
  const words = src
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  if (!words.length) return "Untitled";
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function seedFromKeywords(mode, q) {
  const base =
    mode === "artist"
      ? "modern production, defining instrumentation, generic vocal character, mood and rhythmic feel"
      : "indie pop, 100 BPM, jangly guitar, warm drums, breathy female vocals, nostalgic, lo-fi warmth";
  return q ? `${base} — built around: ${q.slice(0, 80)}` : base;
}
