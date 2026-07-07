// set-generator.js — two-phase set generation. Pure logic + Anthropic calls.
// planSet() designs the arc + per-track briefs (conversation-aware);
// generateTrack() expands one brief into a full Suno prompt. Offline fallbacks
// seed from the preset so a set is never empty. fetchFn is injectable for tests.
import { getPreset, SET_GENRE_TRAPS } from "./set-knowledge.js";
import { DEFAULT_MODEL } from "./constants.js";

const API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

// Runtime → track-count math. TRACK_MINUTES is the assumed per-track length for
// each length mode; CREDITS_PER_TRACK is observed (2026-07-03: ~10 cr/track, two
// variations per Create). trackCount is clamped to the generation-safe band.
export const TRACK_MINUTES = { standard: 3.5, extended: 5.5, "dj-long": 7.5 };
export const CREDITS_PER_TRACK = 10;

export function estimateSet({ runtimeMin, trackLength = "standard" }) {
  const lenMin = TRACK_MINUTES[trackLength] || TRACK_MINUTES.standard;
  const raw = Math.round((Number(runtimeMin) || 0) / lenMin);
  const trackCount = Math.max(3, Math.min(60, raw));
  return { trackCount, credits: trackCount * CREDITS_PER_TRACK };
}

export function sparkline(contour) {
  return contour
    .map((n) => BLOCKS[Math.max(0, Math.min(7, Math.round(((n - 1) / 9) * 7)))])
    .join("");
}

// ±1 discipline: flag any step that moves more than 1 on the 1–10 scale.
export function contourWarnings(contour) {
  const out = [];
  for (let i = 1; i < contour.length; i++) {
    if (Math.abs(contour[i] - contour[i - 1]) > 1)
      out.push(
        `Track ${i}→${i + 1}: energy jumps ${contour[i - 1]}→${contour[i]} (>1 step)`,
      );
  }
  return out;
}

// Human phase labels for the read-only journey strip. Position-based: the first
// track that reaches the arc's max is the Peak, everything after it Releases, and
// the run-up is Warm-up (below mid energy) then Build (at/above mid).
export function phaseLabels(contour) {
  if (!contour.length) return [];
  const max = Math.max(...contour);
  const min = Math.min(...contour);
  const mid = (min + max) / 2;
  const peakIdx = contour.indexOf(max);
  return contour.map((e, i) => {
    if (i === peakIdx || e >= max) return "Peak";
    if (i > peakIdx) return "Release";
    return e < mid ? "Warm-up" : "Build";
  });
}

// Per-track resume-tracker counts for the stage-C progress row.
export function setProgress(set) {
  const tracks = (set && set.tracks) || [];
  return {
    pasted: tracks.filter((t) => t.pasted).length,
    generated: tracks.filter(
      (t) => t.status === "generated" || t.status === "pasted",
    ).length,
    total: tracks.length,
  };
}

// Human-readable "how long ago" for the My Sets list row. `now` is injectable
// for tests; defaults to the real clock at call time.
export function relativeAge(ms, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(s / 3600);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(s / 86400);
  return `${d}d ago`;
}

// Linear-interpolate a contour to exactly n points (rounded to whole energies).
// Endpoints are preserved; used to stretch/shrink a preset's default arc to the
// user's chosen track count.
export function resampleContour(src, n) {
  if (!src.length) return [];
  if (n <= 1) return [Math.round(src[0])];
  if (n === src.length) return src.map((x) => Math.round(x));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i * (src.length - 1)) / (n - 1);
    const lo = Math.floor(t);
    const hi = Math.ceil(t);
    out.push(Math.round(src[lo] + (src[hi] - src[lo]) * (t - lo)));
  }
  return out;
}

export function bpmForPreset(preset, energy) {
  const p = preset.bpmPolicy;
  if (p.kind === "beatless") return "beatless, no fixed tempo";
  if (p.kind === "descend") {
    const idx = energy >= 3 ? 0 : energy === 2 ? 1 : 2;
    return p.steps[Math.min(idx, p.steps.length - 1)];
  }
  return `${Math.round((p.lo + p.hi) / 2)} BPM`;
}

// Bump a single track's energy (±) and re-derive its tempo from the preset policy.
// Pure — returns a new brief; used by the nudgeable arc gate. Clamped to 1..10.
export function nudgeBrief(brief, delta, preset) {
  const arcEnergy = Math.max(1, Math.min(10, (brief.arcEnergy || 1) + delta));
  return {
    ...brief,
    arcEnergy,
    bpmOrBeatless: bpmForPreset(preset, arcEnergy),
  };
}

// Which tracks carry the recurring motif: the opener and the closer.
export function motifTargets(trackCount) {
  if (trackCount < 1) return [];
  if (trackCount < 2) return [0];
  return [0, trackCount - 1];
}

export function offlinePlan(preset, trackCount, forceLyrics = false) {
  const n = Math.max(
    3,
    Math.min(60, Number(trackCount) || preset.defaultContour.length),
  );
  const contour = resampleContour(preset.defaultContour, n);
  const briefs = contour.map((energy, i) => ({
    trackIndex: i + 1,
    arcEnergy: energy,
    bpmOrBeatless: bpmForPreset(preset, energy),
    vocalDefault: forceLyrics ? "full-lead" : preset.vocalDefault,
    leadTexture: preset.palette[i % preset.palette.length],
    doWords: preset.doWords.slice(0, 3),
    dontWords: preset.dontWords.slice(0, 2),
    structureHint: preset.structurePolicy.allow.join(""),
  }));
  return {
    arcType: preset.arcType,
    contour,
    briefs: briefs.map((b) => scrubBrief(b, preset.claimGuard)),
  };
}

export function offlineTrack(preset, brief, forceLyrics = false) {
  const trap = Object.keys(SET_GENRE_TRAPS).find(
    (g) =>
      preset.label.toLowerCase().includes(g.toLowerCase()) ||
      preset.palette.join(" ").toLowerCase().includes(g.toLowerCase()),
  );
  const exclude = [
    ...(preset.setWideExclude || []),
    ...(trap ? [SET_GENRE_TRAPS[trap].fix] : []),
  ]
    .slice(0, 3)
    .join(", ");
  const style = `${preset.palette.slice(0, 4).join(", ")}, ${brief.bpmOrBeatless}, ${brief.doWords.join(", ")}`;
  const structure = preset.structurePolicy.allow.join("\n");
  return {
    title: offlineTrackTitle(preset, brief),
    style: style.slice(0, 200),
    exclude,
    bpmOrBeatless: brief.bpmOrBeatless,
    structure,
    // Offline can't write real lyrics — vocal presets get the skeleton to fill
    // in; instrumental presets get the instrumental marker (unless forced).
    lyrics: writesLyrics(preset, forceLyrics)
      ? `${structure}\n(set your API key to auto-write lyrics)`
      : "[Instrumental]",
    notes: `Offline fallback from the ${preset.label} preset — set your API key for a tailored track.`,
  };
}

// Offline can't invent good titles; derive a stable one from the track's lead
// texture (Title-Cased, ≤4 words) so the field is never blank, with a numbered
// fallback. Not exported — offlineTrack's private helper.
function offlineTrackTitle(preset, brief) {
  const src = String((brief && brief.leadTexture) || "").trim();
  const words = src
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  if (words.length)
    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return `Track ${(brief && brief.trackIndex) || ""}`.trim();
}

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
  maxTokens = 1500,
  strict = false,
}) {
  const doFetch = fetchFn || fetch;
  const messages = [{ role: "user", content: userMessage }];
  // Strict mode: prefill the assistant turn with "{" to force JSON-only output
  // (the model continues after the brace). Used on retry after a parse failure.
  if (strict) messages.push({ role: "assistant", content: "{" });
  const res = await doFetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages,
    }),
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
  // Re-attach the prefilled brace unless the response already carries it.
  if (strict && !text.trimStart().startsWith("{")) text = `{${text}`;
  return text;
}

const PLAN_SYSTEM = `You are a world-class functional-music set designer for Suno. Given a preset frame and a user's vibe, design a coherent multi-track SET with an energy arc.
RULES: energy is 1–10 (1=ambient/beatless, 5=danceable, 8-9=festival). Move ±1 between adjacent tracks unless an intentional reset. Respect the preset's arc type, energy band, BPM policy, vocal default, and do/don't words. Each track gets a DISTINCT lead texture and hook idea — never restate the same track N times. If a SET THEME is given, EVERY track's hook idea must live inside that theme's world — the preset only sets the sound, never the lyrical subject; do not fall back on the preset palette's own imagery for hooks. If SET GENRES are given, they define the sound space — respect the preset's arc/energy/structure but let the genres drive the style, blending or rotating them across tracks. If a STORY is given, treat it as the master brief: the contour follows the story's emotional arc and each track is a successive beat/scene of it, in order. If the preset is beatless, briefs use "beatless, no fixed tempo", never a BPM number. If a MOTIF is given, weave that exact hook/lyric line into the opening and closing tracks so the set bookends itself. If none is given, PROPOSE a short signature motif line that fits the theme and return it as "motif". Never make medical or therapeutic claims (no "repairs DNA", "entrains your brain", "heals", "cures", etc.).
OUTPUT ONLY JSON: {"arcType":"...","contour":[8 numbers],"motif":"...","briefs":[{"trackIndex":1,"arcEnergy":N,"bpmOrBeatless":"...","vocalDefault":"...","leadTexture":"...","doWords":[...],"dontWords":[...],"structureHint":"[Intro]..."}]}`;

export const TRACK_SYSTEM = `You are a world-class Suno prompt engineer AND lyricist. Expand ONE track brief into a Suno prompt. Genre first, 6–12 descriptors, front-loaded, ~150–180 chars. Honor the brief's bpmOrBeatless exactly (if beatless, do NOT add a BPM). Only use [Section] tags allowed by the brief's structureHint. Never emit artist names or empty evaluative words. Never make medical/therapeutic claims.
TITLE: ALWAYS give this track a distinct, evocative title (2–5 words) that fits its moment in the set — never an artist name, never "Untitled", never the same as another track.
LYRICS: If the brief's vocalDefault is a sung or chanted style (full-lead or chant), WRITE full, specific, non-cliché lyrics — verses plus a chorus built around THIS track's distinct hook — using the allowed [Section] tags. If the vocalDefault is instrumental / wordless / none, set "lyrics" to exactly "[Instrumental]" and write NO words. VOCAL DELIVERY: the STYLE field is the reliable lever — put delivery there, described per section (e.g. "breathy intimate verses building to a belted chorus, stripped whispered bridge"). In the LYRICS, the ONLY reliable per-section cue is a SHORT parenthetical on its OWN line, sitting between the plain section tag and the lyric lines — i.e. [Bridge] on its own line, then (whispered) alone on the next line, then the clean lyric lines. NEVER put a second bracket after a section tag — [Verse] [Soft, Intimate] gets SUNG out loud as lyrics. NEVER glue the cue onto a lyric line, and NEVER put lyric words inside brackets. Keep section tags plain ([Verse] / [Chorus] / [Bridge]); use at most 2–3 cues per song (the bridge is the highest-value spot). A true whisper also needs that section kept sparse in the style — Suno won't whisper over a wall of sound. LYRIC CRAFT: keep lines even (each within ±2 syllables of the others, or Suno rushes/glitches); favor ABAB + slant / near rhymes over sing-song AABB perfect rhymes; keep the chorus short and repeat its exact text; respell tricky words, NAMES, and numbers phonetically. Never emit numeric/parameter tags like [Reverb: 30%] (proven placebo) — use words (reverb-drenched).
OUTPUT ONLY JSON: {"title":"...","style":"...","exclude":"...","bpmOrBeatless":"...","structure":"[Intro]...","lyrics":"full lyrics with [Section] tags, or [Instrumental]","notes":"..."}`;

// Only sung/chant presets get written words; wordless/instrumental/none stay instrumental.
const LYRIC_VOCALS = new Set(["full-lead", "chant"]);
export function presetWritesLyrics(preset) {
  return LYRIC_VOCALS.has(preset.vocalDefault);
}

// forceLyrics explicitly overrides the preset default — set from the UI when the
// user gives a lyrics theme on an otherwise-instrumental preset.
export function writesLyrics(preset, forceLyrics) {
  return !!forceLyrics || presetWritesLyrics(preset);
}

// When forcing lyrics onto an instrumental preset, allow lyrical sections even
// if the preset normally bans them (the user explicitly wants a song).
export function effectivePolicy(preset, forceLyrics) {
  const p = preset.structurePolicy;
  if (!forceLyrics) return p;
  const add = ["[Verse]", "[Chorus]"];
  return {
    allow: [...new Set([...p.allow, ...add])],
    ban: p.ban.filter((t) => !add.includes(t)),
  };
}

function convoText(conversation = []) {
  return conversation
    .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n");
}

export async function planSet({
  preset,
  concept,
  theme = "",
  scene = "",
  story = "",
  genres = [],
  vibe = [],
  subChoices = {},
  conversation = [],
  trackCount,
  forceLyrics = false,
  motif = "",
  apiKey,
  model = DEFAULT_MODEL,
  fetchFn,
}) {
  if (!apiKey)
    return {
      ...offlinePlan(preset, trackCount, forceLyrics),
      motif: motif || "",
      offline: true,
      offlineNote:
        "PREVIEW ONLY — no API key, so this is the preset's built-in arc with placeholder lyrics (not a real AI set). Add a key in ⚙ Settings, then re-plan.",
    };
  // Two independent axes. SCENE colors the SOUND (style/textures/energy); THEME
  // governs the LYRICS. Keep them apart so a subject like "vibe coding" never
  // bleeds into descriptors, and a sonic word like "filthy" never becomes a hook.
  const sceneDirective = scene
    ? `\nSCENE / SOUND (color the style descriptors, textures, and energy with this — it is NOT lyrical subject matter): ${scene}`
    : "";
  const moodDirective = vibe.length
    ? `\nMOOD WORDS (sound/feel, not lyrics): ${vibe.join(", ")}`
    : "";
  const themeDirective = theme
    ? `\nSET THEME (governs every track's hook idea and lyric imagery — do NOT drift into the preset palette's or scene's own imagery): ${theme}`
    : "";
  // Story mode: the whole set is one narrative journey. The plan reads the story
  // as a timeline — deriving the SOUND from its setting/sensory detail, the
  // LYRICS from its feeling, and shaping the CONTOUR to trace its arc so each
  // track is a successive moment in it (dawn → peak → comedown, etc.).
  const storyDirective = story
    ? `\nSTORY (the master brief — read it as a journey across the whole set): """${story}"""\nFrom the STORY: derive the SOUND from its setting/sensory detail and the LYRIC THEME from its feeling; shape the contour to follow the story's emotional arc start→finish; make EACH track a successive beat/scene of it, and put that moment in the brief's leadTexture/hook so the tracks read as chapters in order.`
    : "";
  // Explicit genre choices override the preset's implied genre for the SOUND.
  const genreDirective = genres.length
    ? `\nSET GENRES (the sound must live in these — blend or rotate them across tracks; every track's style sits inside this genre space): ${genres.join(", ")}`
    : "";
  // How many tracks the user asked for — the plan must emit exactly this many
  // briefs and a contour of the same length.
  const count = Math.max(
    3,
    Math.min(60, Number(trackCount) || preset.defaultContour.length),
  );
  const countDirective = `\nTRACK COUNT: ${count} — output EXACTLY ${count} briefs and a contour array of length ${count}.`;
  // forceLyrics: the user gave a lyrics theme on an otherwise-instrumental
  // preset — tell the model to write real sung lyrics on that theme anyway.
  const lyricDirective = forceLyrics
    ? `\nFORCED VOCALS: every track is SUNG (full-lead) with real lyrics living inside the SET THEME, even though the preset is normally instrumental. Use [Verse]/[Chorus] sections. Set each brief's vocalDefault to "full-lead".`
    : "";
  // A user-given motif is a directive (weave it into opener+closer); absent
  // one, PLAN_SYSTEM already tells the model to propose its own.
  const motifDirective = motif
    ? `\nMOTIF (a recurring hook/lyric line that MUST appear in the opener and closer): ${motif}`
    : "";
  const userMessage = `PRESET: ${JSON.stringify({
    label: preset.label,
    arcType: preset.arcType,
    defaultContour: preset.defaultContour,
    energyBand: preset.energyBand,
    bpmPolicy: preset.bpmPolicy,
    vocalDefault: preset.vocalDefault,
    palette: preset.palette,
    doWords: preset.doWords,
    dontWords: preset.dontWords,
    structurePolicy: preset.structurePolicy,
  })}
SUB-CHOICES: ${JSON.stringify(subChoices)}
USER BRIEF: "${concept}"${genreDirective}${countDirective}${sceneDirective}${moodDirective}${themeDirective}${storyDirective}${lyricDirective}${motifDirective}
CONVERSATION SO FAR (refine the plan per the latest turn):
${convoText(conversation)}`;
  try {
    const raw = await callClaude({
      apiKey,
      model,
      system: PLAN_SYSTEM,
      userMessage,
      fetchFn,
      maxTokens: 4096, // 8 briefs of JSON — 1500 truncated and broke parsing
    });
    const obj = extractJson(raw);
    if (!Array.isArray(obj.briefs) || !Array.isArray(obj.contour))
      throw new Error("bad shape");
    return {
      arcType: String(obj.arcType || preset.arcType),
      contour: obj.contour,
      motif: String(obj.motif || motif || ""),
      briefs: obj.briefs.map((b) => scrubBrief(b, preset.claimGuard)),
    };
  } catch (err) {
    if (/API key|Rate limited|API error/.test(err.message))
      return {
        ...offlinePlan(preset, trackCount, forceLyrics),
        motif: motif || "",
        offline: true,
        offlineNote: `${err.message} Showing the preset's built-in arc.`,
      };
    // parse failure → one strict (JSON-prefill) retry, then offline
    try {
      const obj = extractJson(
        await callClaude({
          apiKey,
          model,
          system: PLAN_SYSTEM,
          userMessage,
          fetchFn,
          maxTokens: 4096,
          strict: true,
        }),
      );
      if (!Array.isArray(obj.briefs) || !Array.isArray(obj.contour))
        throw new Error("bad shape");
      return {
        arcType: String(obj.arcType || preset.arcType),
        contour: obj.contour,
        motif: String(obj.motif || motif || ""),
        briefs: obj.briefs.map((b) => scrubBrief(b, preset.claimGuard)),
      };
    } catch {
      return {
        ...offlinePlan(preset, trackCount, forceLyrics),
        motif: motif || "",
        offline: true,
        offlineNote:
          "PREVIEW ONLY — the AI response was unparseable, so this is the preset's built-in arc (placeholder lyrics). Try Re-plan; if it repeats, check your key/model in ⚙ Settings.",
      };
    }
  }
}

function stripClaims(text, guard = []) {
  let out = String(text || "");
  for (const phrase of guard) {
    out = out
      .replace(
        new RegExp(
          `\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "ig",
        ),
        "",
      )
      .replace(/\s{2,}/g, " ")
      .replace(/,\s*,/g, ",")
      .trim();
  }
  return out.replace(/(^[,\s]+|[,\s]+$)/g, "");
}

// Strip any claimGuard phrase from a brief's user-visible string fields (the
// arc-gate renders these before track generation, so they must be clean too).
function scrubBrief(brief, guard) {
  if (!guard || !guard.length) return brief;
  const s = (t) => stripClaims(t, guard);
  return {
    ...brief,
    leadTexture: s(brief.leadTexture),
    structureHint: s(brief.structureHint),
    doWords: Array.isArray(brief.doWords)
      ? brief.doWords.map(s)
      : brief.doWords,
    dontWords: Array.isArray(brief.dontWords)
      ? brief.dontWords.map(s)
      : brief.dontWords,
  };
}

// Beatless presets must never carry a BPM number, even if the model emits one.
function stripBpmIfBeatless(text, preset) {
  if (!preset.bpmPolicy || preset.bpmPolicy.kind !== "beatless") return text;
  return String(text || "")
    .replace(/\d{1,3}\s*bpm/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .replace(/(^[,\s]+|[,\s]+$)/g, "");
}

function normalizeTrack(obj, preset, forceLyrics = false) {
  const guard = preset.claimGuard || [];
  const beatless = preset.bpmPolicy && preset.bpmPolicy.kind === "beatless";
  const structure = String(obj.structure || "").trim();
  // Code-enforce the vocal contract: instrumental/wordless presets never carry
  // lexical lyrics, even if the model wrote some. Vocal presets keep the lyrics
  // (falling back to the section skeleton if the model returned none). Honesty
  // (stripClaims) always runs, even when lyrics are forced.
  const lyrics = writesLyrics(preset, forceLyrics)
    ? stripClaims(String(obj.lyrics || "").trim(), guard) || structure
    : "[Instrumental]";
  return {
    title: stripClaims(String(obj.title || "").trim(), guard),
    style: stripBpmIfBeatless(stripClaims(obj.style, guard), preset).slice(
      0,
      200,
    ),
    exclude: stripClaims(obj.exclude, guard),
    bpmOrBeatless: beatless
      ? "beatless, no fixed tempo"
      : String(obj.bpmOrBeatless || "").trim(),
    structure,
    lyrics,
    notes: stripClaims(obj.notes, guard),
  };
}

// The track-length lever: extended/dj-long make each track physically longer by
// injecting a long instrumental intro/outro (mix-ready), which is how a set trades
// track count for runtime at the same per-generation credit cost. Only add tags the
// preset allows; if it allows neither [Intro] nor [Outro], fall back to a prose note.
const LENGTH_BARS = { extended: 16, "dj-long": 32 };
function lengthAugmentedBrief(brief, preset, trackLength) {
  const bars = LENGTH_BARS[trackLength];
  if (!bars) return { brief, note: "" };
  const allow = preset.structurePolicy.allow || [];
  const parts = [];
  if (allow.includes("[Intro]"))
    parts.push(`[Intro] ${bars} bars instrumental`);
  if (allow.includes("[Outro]"))
    parts.push(`[Outro] ${bars} bars instrumental for mixing`);
  if (!parts.length)
    return {
      brief,
      note: `\nLENGTH: make this a longer ~${TRACK_MINUTES[trackLength]}min track with an extended instrumental intro and outro.`,
    };
  return {
    brief: {
      ...brief,
      structureHint: `${brief.structureHint || ""} ${parts.join(" ")}`.trim(),
    },
    note: "",
  };
}

export async function generateTrack({
  preset,
  brief,
  context = {},
  trackLength = "standard",
  forceLyrics = false,
  motif = "",
  isMotifTrack = false,
  apiKey,
  model = DEFAULT_MODEL,
  fetchFn,
}) {
  if (!apiKey) return offlineTrack(preset, brief, forceLyrics);
  const { brief: fullBrief, note: lengthNote } = lengthAugmentedBrief(
    brief,
    preset,
    trackLength,
  );
  const vibe = Array.isArray(context.vibe) ? context.vibe.join(", ") : "";
  const themeLine = context.theme
    ? `\nSET THEME — keep ALL lyric imagery inside this one metaphor world: ${context.theme}`
    : "";
  const vibeLine = vibe ? `\nSET VIBE — how it should feel: ${vibe}` : "";
  const pol = effectivePolicy(preset, forceLyrics);
  // The guardrail line must reflect the EFFECTIVE vocal state, not the raw
  // preset default — otherwise a model faithfully honoring "vocalDefault=
  // instrumental" will emit [Instrumental] even when forceLyrics overrides it.
  const effectiveVocal = writesLyrics(preset, forceLyrics)
    ? "full-lead"
    : preset.vocalDefault;
  const forceLyricsLine = forceLyrics
    ? `\nFORCED VOCALS: this track is SUNG (full-lead) with real lyrics on the SET THEME above, even though the preset is normally instrumental — write full verses/chorus, do not set lyrics to "[Instrumental]".`
    : "";
  // Bookend tracks (opener/closer) get the recurring motif directive; other
  // tracks in the set never see it.
  const motifLine =
    isMotifTrack && motif
      ? `\nMOTIF — this is a bookend track: feature this recurring hook/lyric line prominently (${writesLyrics(preset, forceLyrics) ? "as a sung line" : "as a signature musical hook"}): ${motif}`
      : "";
  const userMessage = `BRIEF: ${JSON.stringify(fullBrief)}
PRESET GUARDRAILS: vocalDefault=${effectiveVocal}; allowed tags=${pol.allow.join(" ")}; banned tags=${pol.ban.join(" ")}; set-wide exclude=${(preset.setWideExclude || []).join(", ")}${themeLine}${vibeLine}${forceLyricsLine}${motifLine}${lengthNote}`;
  try {
    return normalizeTrack(
      extractJson(
        await callClaude({
          apiKey,
          model,
          system: TRACK_SYSTEM,
          userMessage,
          fetchFn,
          maxTokens: 2048, // style + full lyrics need room
        }),
      ),
      preset,
      forceLyrics,
    );
  } catch (err) {
    if (/API key|Rate limited|API error/.test(err.message))
      return offlineTrack(preset, brief, forceLyrics);
    // one strict (JSON-prefill) retry, then offline
    try {
      return normalizeTrack(
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
        preset,
        forceLyrics,
      );
    } catch {
      return offlineTrack(preset, brief, forceLyrics);
    }
  }
}
