import { describe, it, expect } from "vitest";
import { getPreset } from "./set-knowledge.js";
import {
  contourWarnings,
  sparkline,
  offlinePlan,
  offlineTrack,
  planSet,
  generateTrack,
  estimateSet,
  CREDITS_PER_TRACK,
  TRACK_SYSTEM,
  resampleContour,
  phaseLabels,
  writesLyrics,
  effectivePolicy,
  presetWritesLyrics,
  relativeAge,
  setProgress,
  nudgeBrief,
  bpmForPreset,
  motifTargets,
} from "./set-generator.js";

describe("vocal delivery-mode lyric guidance", () => {
  it("routes delivery modes to tested section-header tags, not inline cues", () => {
    expect(TRACK_SYSTEM).toContain("[Belting] not [Belt]");
    expect(TRACK_SYSTEM).toContain("[Chorus] [Belting, Powerful]");
  });

  it("carries lyric-craft + placebo-ban rules", () => {
    expect(TRACK_SYSTEM).toContain("±2");
    expect(TRACK_SYSTEM).toMatch(/slant/i);
    expect(TRACK_SYSTEM).toContain("[Reverb: 30%]");
  });
});

// Fake Anthropic response helper.
const fakeFetch = (jsonText) => async () => ({
  ok: true,
  json: async () => ({ content: [{ text: jsonText }] }),
});

describe("pure helpers", () => {
  it("contourWarnings flags a >1 jump", () => {
    expect(contourWarnings([3, 3, 5, 5])).toHaveLength(1); // 3->5 is +2
    expect(contourWarnings([3, 3, 2, 2])).toEqual([]);
  });
  it("sparkline maps 1..10 to blocks of the right length", () => {
    expect(sparkline([1, 5, 8]).length).toBe(3);
  });
});

describe("offline fallbacks", () => {
  it("offlinePlan returns the preset's default contour and 8 briefs", () => {
    const plan = offlinePlan(getPreset("sleep"));
    expect(plan.contour).toEqual([3, 3, 2, 2, 2, 1, 1, 1]);
    expect(plan.briefs).toHaveLength(8);
    expect(plan.briefs[0].trackIndex).toBe(1);
  });
  it("offlineTrack for a beatless preset uses 'beatless', never a BPM", () => {
    const p = getPreset("meditation");
    const t = offlineTrack(p, offlinePlan(p).briefs[0]);
    expect(t.bpmOrBeatless).toMatch(/beatless/i);
  });
  it("deep-focus offline track bans [Chorus] in its structure", () => {
    const p = getPreset("deep-focus");
    const t = offlineTrack(p, offlinePlan(p).briefs[0]);
    expect(t.structure).not.toMatch(/\[Chorus\]/);
  });
  it("offlineTrack always returns a non-empty title", () => {
    const p = getPreset("sleep");
    const t = offlineTrack(p, offlinePlan(p).briefs[0]);
    expect(typeof t.title).toBe("string");
    expect(t.title.length).toBeGreaterThan(0);
  });
});

describe("planSet", () => {
  it("parses a well-formed API plan", async () => {
    const json = JSON.stringify({
      arcType: "descending",
      contour: [3, 3, 2, 2, 2, 1, 1, 1],
      briefs: Array.from({ length: 8 }, (_, i) => ({
        trackIndex: i + 1,
        arcEnergy: 2,
        bpmOrBeatless: "60 BPM",
        vocalDefault: "none",
        leadTexture: "felt piano",
        doWords: ["soft"],
        dontWords: ["percussion"],
        structureHint: "[Intro][Outro]",
      })),
    });
    const plan = await planSet({
      preset: getPreset("sleep"),
      concept: "rain",
      apiKey: "k",
      fetchFn: fakeFetch(json),
    });
    expect(plan.arcType).toBe("descending");
    expect(plan.briefs).toHaveLength(8);
  });
  it("falls back to offline plan with no apiKey", async () => {
    const plan = await planSet({
      preset: getPreset("sleep"),
      concept: "rain",
      apiKey: "",
    });
    expect(plan.contour).toEqual([3, 3, 2, 2, 2, 1, 1, 1]);
  });
  it("falls back to offline plan on unparseable API output", async () => {
    const plan = await planSet({
      preset: getPreset("sleep"),
      concept: "rain",
      apiKey: "k",
      fetchFn: fakeFetch("not json at all"),
    });
    expect(plan.briefs).toHaveLength(8);
  });

  it("sends scene (sound) and theme (lyrics) as separate directives", async () => {
    const good = JSON.stringify({
      arcType: "descending",
      contour: [3, 3, 2, 2, 2, 1, 1, 1],
      briefs: Array.from({ length: 8 }, (_, i) => ({
        trackIndex: i + 1,
        arcEnergy: 2,
        bpmOrBeatless: "60 BPM",
        vocalDefault: "none",
        leadTexture: "x",
        doWords: [],
        dontWords: [],
        structureHint: "[Intro]",
      })),
    });
    let sentBody;
    const capture = async (_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ content: [{ text: good }] }) };
    };
    await planSet({
      preset: getPreset("sleep"),
      concept: "summary",
      scene: "rooftop day party, slow-burn bass",
      theme: "vibe coding",
      vibe: ["funky", "filthy"],
      apiKey: "k",
      fetchFn: capture,
    });
    const msg = sentBody.messages[0].content;
    expect(msg).toContain("SCENE / SOUND");
    expect(msg).toContain("rooftop day party");
    expect(msg).toContain("MOOD WORDS");
    expect(msg).toContain("funky, filthy");
    expect(msg).toContain("SET THEME");
    expect(msg).toContain("vibe coding");
    // The theme must be framed as governing lyrics, not sound.
    expect(msg).toMatch(/SET THEME[^\n]*lyric/i);
  });

  it("sends story as the master brief and genres as the sound space", async () => {
    const good = JSON.stringify({
      arcType: "wave",
      contour: [2, 3, 5, 7, 8, 6, 4, 3],
      briefs: Array.from({ length: 8 }, (_, i) => ({
        trackIndex: i + 1,
        arcEnergy: 4,
        bpmOrBeatless: "120 BPM",
        vocalDefault: "none",
        leadTexture: "x",
        doWords: [],
        dontWords: [],
        structureHint: "[Intro]",
      })),
    });
    let sentBody;
    const capture = async (_url, opts) => {
      sentBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ content: [{ text: good }] }) };
    };
    await planSet({
      preset: getPreset("sleep"),
      concept: "story",
      story: "dawn on the playa, bike gliding, then the deep-night crowd",
      genres: ["Deep house", "Melodic techno"],
      apiKey: "k",
      fetchFn: capture,
    });
    const msg = sentBody.messages[0].content;
    expect(msg).toContain("STORY");
    expect(msg).toContain("dawn on the playa");
    expect(msg).toMatch(/STORY[\s\S]*journey/i);
    expect(msg).toContain("SET GENRES");
    expect(msg).toContain("Deep house, Melodic techno");
  });
});

describe("generateTrack", () => {
  it("parses a well-formed API track", async () => {
    const json = JSON.stringify({
      style: "felt piano, beatless",
      exclude: "percussion",
      bpmOrBeatless: "beatless",
      structure: "[Intro][Outro]",
      notes: "seamless",
    });
    const p = getPreset("sleep");
    const t = await generateTrack({
      preset: p,
      brief: offlinePlan(p).briefs[0],
      apiKey: "k",
      fetchFn: fakeFetch(json),
    });
    expect(t.style).toMatch(/felt piano/);
  });
  it("strips a claimGuard phrase if the model emits one", async () => {
    const json = JSON.stringify({
      style: "528Hz drone that repairs DNA",
      exclude: "",
      bpmOrBeatless: "beatless",
      structure: "[Intro]",
      notes: "",
    });
    const p = getPreset("sound-healing");
    const t = await generateTrack({
      preset: p,
      brief: offlinePlan(p).briefs[0],
      apiKey: "k",
      fetchFn: fakeFetch(json),
    });
    expect(t.style.toLowerCase()).not.toContain("repairs dna");
  });
});

describe("planSet retry", () => {
  it("retries once on a transient parse failure then succeeds", async () => {
    let calls = 0;
    const good = JSON.stringify({
      arcType: "descending",
      contour: [3, 3, 2, 2, 2, 1, 1, 1],
      briefs: Array.from({ length: 8 }, (_, i) => ({
        trackIndex: i + 1,
        arcEnergy: 2,
        bpmOrBeatless: "60 BPM",
        vocalDefault: "none",
        leadTexture: "felt piano",
        doWords: ["soft"],
        dontWords: ["percussion"],
        structureHint: "[Intro]",
      })),
    });
    const flaky = async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({
          content: [{ text: calls === 1 ? "garbage not json" : good }],
        }),
      };
    };
    const plan = await planSet({
      preset: getPreset("sleep"),
      concept: "rain",
      apiKey: "k",
      fetchFn: flaky,
    });
    expect(calls).toBe(2);
    expect(plan.briefs).toHaveLength(8);
  });
});

describe("plan-phase honesty + offline signal", () => {
  it("scrubs a claimGuard phrase out of a brief's leadTexture", async () => {
    const dirty = JSON.stringify({
      arcType: "steady",
      contour: [1, 1, 2, 2, 2, 2, 1, 1],
      briefs: Array.from({ length: 8 }, (_, i) => ({
        trackIndex: i + 1,
        arcEnergy: 1,
        bpmOrBeatless: "beatless",
        vocalDefault: "none",
        leadTexture: "528Hz drone that repairs DNA",
        doWords: ["resonant"],
        dontWords: ["upbeat"],
        structureHint: "[Intro]",
      })),
    });
    const plan = await planSet({
      preset: getPreset("sound-healing"),
      concept: "calm",
      apiKey: "k",
      fetchFn: fakeFetch(dirty),
    });
    expect(plan.briefs[0].leadTexture.toLowerCase()).not.toContain(
      "repairs dna",
    );
  });

  it("flags offline when there is no API key", async () => {
    const plan = await planSet({
      preset: getPreset("sleep"),
      concept: "rain",
      apiKey: "",
    });
    expect(plan.offline).toBe(true);
    expect(plan.offlineNote).toBeTruthy();
  });
});

describe("beatless BPM guard", () => {
  it("forces beatless and strips a stray BPM from a beatless preset's API output", async () => {
    const json = JSON.stringify({
      style: "singing bowls, 60 BPM drone, spacious",
      exclude: "",
      bpmOrBeatless: "60 BPM",
      structure: "[Intro]",
      notes: "",
    });
    const p = getPreset("meditation");
    const t = await generateTrack({
      preset: p,
      brief: offlinePlan(p).briefs[0],
      apiKey: "k",
      fetchFn: fakeFetch(json),
    });
    expect(t.bpmOrBeatless).toMatch(/beatless/i);
    expect(t.style).not.toMatch(/\d{1,3}\s*bpm/i);
  });
});

describe("lyrics generation", () => {
  it("writes lyrics for a sung/full-lead preset", async () => {
    const json = JSON.stringify({
      style: "deep hypnotic house, 124 BPM",
      exclude: "",
      bpmOrBeatless: "124 BPM",
      structure: "[Verse][Chorus]",
      lyrics:
        "[Verse]\nlocked in, lights low\n[Chorus]\ndon't knock, I'm not home",
      notes: "",
    });
    const p = getPreset("day-floor-peak"); // vocalDefault: full-lead
    const t = await generateTrack({
      preset: p,
      brief: offlinePlan(p).briefs[0],
      apiKey: "k",
      fetchFn: fakeFetch(json),
    });
    expect(t.lyrics).toMatch(/I'm not home/);
  });

  it("forces [Instrumental] for an instrumental/beatless preset even if the model writes words", async () => {
    const json = JSON.stringify({
      style: "singing bowls, beatless",
      exclude: "",
      bpmOrBeatless: "beatless",
      structure: "[Intro]",
      lyrics: "[Verse]\nthese words should be stripped",
      notes: "",
    });
    const p = getPreset("meditation"); // vocalDefault: none
    const t = await generateTrack({
      preset: p,
      brief: offlinePlan(p).briefs[0],
      apiKey: "k",
      fetchFn: fakeFetch(json),
    });
    expect(t.lyrics).toBe("[Instrumental]");
  });

  it("offlineTrack marks instrumental presets [Instrumental]", () => {
    const p = getPreset("ambient-soundscape");
    expect(offlineTrack(p, offlinePlan(p).briefs[0]).lyrics).toBe(
      "[Instrumental]",
    );
  });
});

describe("estimateSet", () => {
  it("1h DJ-Long → 8 tracks / 80 credits (spec row)", () => {
    expect(estimateSet({ runtimeMin: 60, trackLength: "dj-long" })).toEqual({
      trackCount: 8,
      credits: 80,
    });
  });
  it("30m standard → 9 tracks (round 30/3.5)", () => {
    expect(
      estimateSet({ runtimeMin: 30, trackLength: "standard" }).trackCount,
    ).toBe(9);
  });
  it("2h dj-long → 16 tracks", () => {
    expect(
      estimateSet({ runtimeMin: 120, trackLength: "dj-long" }).trackCount,
    ).toBe(16);
  });
  it("clamps tiny runtime up to 3", () => {
    expect(
      estimateSet({ runtimeMin: 5, trackLength: "standard" }).trackCount,
    ).toBe(3);
  });
  it("clamps huge runtime down to 60", () => {
    expect(
      estimateSet({ runtimeMin: 600, trackLength: "standard" }).trackCount,
    ).toBe(60);
  });
  it("credits track the constant", () => {
    const { trackCount, credits } = estimateSet({
      runtimeMin: 60,
      trackLength: "standard",
    });
    expect(credits).toBe(trackCount * CREDITS_PER_TRACK);
  });
  it("defaults to standard when trackLength omitted", () => {
    expect(estimateSet({ runtimeMin: 60 })).toEqual(
      estimateSet({ runtimeMin: 60, trackLength: "standard" }),
    );
  });
});

describe("resampleContour", () => {
  it("returns the source unchanged when n equals its length", () => {
    expect(resampleContour([3, 3, 2, 2, 2, 1, 1, 1], 8)).toEqual([
      3, 3, 2, 2, 2, 1, 1, 1,
    ]);
  });
  it("keeps endpoints when resampling to fewer points", () => {
    const out = resampleContour([2, 4, 6, 8], 3);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe(2);
    expect(out[2]).toBe(8);
  });
  it("interpolates when resampling to more points", () => {
    const out = resampleContour([2, 8], 5);
    expect(out).toEqual([2, 4, 5, 7, 8]); // rounded linear ramp (round(6.5)=7)
  });
});

describe("variable track count", () => {
  it("offlinePlan emits N briefs and a length-N contour", () => {
    const plan = offlinePlan(getPreset("day-floor-peak"), 4);
    expect(plan.briefs).toHaveLength(4);
    expect(plan.contour).toHaveLength(4);
    expect(plan.briefs[0].trackIndex).toBe(1);
    expect(plan.briefs[3].trackIndex).toBe(4);
  });
  it("offlinePlan clamps a too-large count to 60 and too-small to 3", () => {
    expect(offlinePlan(getPreset("sleep"), 99).briefs).toHaveLength(60);
    expect(offlinePlan(getPreset("sleep"), 1).briefs).toHaveLength(3);
  });
  it("offlinePlan defaults to the preset's own contour length", () => {
    expect(offlinePlan(getPreset("sleep")).briefs).toHaveLength(8);
  });
  it("planSet forwards trackCount into the plan user message", async () => {
    let sentBody;
    const capture = async (_u, opts) => {
      sentBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                arcType: "journey",
                contour: [6, 6, 7, 7],
                briefs: Array.from({ length: 4 }, (_, i) => ({
                  trackIndex: i + 1,
                  arcEnergy: 6,
                  bpmOrBeatless: "124 BPM",
                  vocalDefault: "full-lead",
                  leadTexture: "x",
                  doWords: [],
                  dontWords: [],
                  structureHint: "[Intro]",
                })),
              }),
            },
          ],
        }),
      };
    };
    await planSet({
      preset: getPreset("day-floor-peak"),
      concept: "x",
      trackCount: 4,
      apiKey: "k",
      fetchFn: capture,
    });
    expect(sentBody.messages[0].content).toContain("TRACK COUNT: 4");
  });
  it("planSet offline (no key) honours trackCount", async () => {
    const plan = await planSet({
      preset: getPreset("sleep"),
      concept: "x",
      trackCount: 5,
      apiKey: "",
    });
    expect(plan.briefs).toHaveLength(5);
  });
});

describe("track-length lever", () => {
  const capturePlan = () => {
    const box = {};
    box.fetch = async (_u, opts) => {
      box.body = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                style: "house",
                exclude: "",
                bpmOrBeatless: "124 BPM",
                structure: "[Intro][Drop][Outro]",
                lyrics: "[Verse]\nx\n[Chorus]\ny",
                notes: "",
              }),
            },
          ],
        }),
      };
    };
    return box;
  };

  it("dj-long adds long intro/outro bars to the brief for an intro/outro-allowing preset", async () => {
    const box = capturePlan();
    const p = getPreset("day-floor-peak"); // allows [Intro] and [Outro]
    await generateTrack({
      preset: p,
      brief: offlinePlan(p).briefs[0],
      trackLength: "dj-long",
      apiKey: "k",
      fetchFn: box.fetch,
    });
    expect(box.body.messages[0].content).toContain(
      "[Intro] 32 bars instrumental",
    );
    expect(box.body.messages[0].content).toContain(
      "[Outro] 32 bars instrumental for mixing",
    );
  });
  it("extended uses 16 bars", async () => {
    const box = capturePlan();
    const p = getPreset("day-floor-peak");
    await generateTrack({
      preset: p,
      brief: offlinePlan(p).briefs[0],
      trackLength: "extended",
      apiKey: "k",
      fetchFn: box.fetch,
    });
    expect(box.body.messages[0].content).toContain(
      "[Intro] 16 bars instrumental",
    );
  });
  it("standard leaves the brief structureHint untouched", async () => {
    const box = capturePlan();
    const p = getPreset("day-floor-peak");
    await generateTrack({
      preset: p,
      brief: offlinePlan(p).briefs[0],
      trackLength: "standard",
      apiKey: "k",
      fetchFn: box.fetch,
    });
    expect(box.body.messages[0].content).not.toContain("bars instrumental");
  });
});

describe("theme-aware lyric gating", () => {
  it("writesLyrics: forceLyrics flips an instrumental preset to vocal", () => {
    expect(writesLyrics(getPreset("deep-focus"), false)).toBe(false);
    expect(writesLyrics(getPreset("deep-focus"), true)).toBe(true);
    expect(writesLyrics(getPreset("day-floor-peak"), false)).toBe(true);
  });
  it("effectivePolicy adds Verse/Chorus and unbans them only when forcing", () => {
    const p = getPreset("deep-focus"); // bans [Chorus]/[Verse]/[Hook]
    const off = effectivePolicy(p, false);
    expect(off.allow).toEqual(p.structurePolicy.allow);
    const on = effectivePolicy(p, true);
    expect(on.allow).toContain("[Verse]");
    expect(on.allow).toContain("[Chorus]");
    expect(on.ban).not.toContain("[Chorus]");
  });
  it("generateTrack with forceLyrics writes lyrics on an instrumental preset", async () => {
    const json = JSON.stringify({
      style: "warm rhodes, sung",
      exclude: "",
      bpmOrBeatless: "70 BPM",
      structure: "[Verse][Chorus]",
      lyrics: "[Verse]\nlate night code\n[Chorus]\nship it anyway",
      notes: "",
    });
    const p = getPreset("deep-focus");
    const t = await generateTrack({
      preset: p,
      brief: offlinePlan(p, 4, true).briefs[0],
      trackLength: "standard",
      forceLyrics: true,
      apiKey: "k",
      fetchFn: fakeFetch(json),
    });
    expect(t.lyrics).toMatch(/ship it anyway/);
    expect(t.lyrics).not.toBe("[Instrumental]");
  });
  it("generateTrack WITHOUT forceLyrics still forces [Instrumental] on an instrumental preset", async () => {
    const json = JSON.stringify({
      style: "warm rhodes",
      exclude: "",
      bpmOrBeatless: "70 BPM",
      structure: "[Intro]",
      lyrics: "[Verse]\nwords",
      notes: "",
    });
    const p = getPreset("deep-focus");
    const t = await generateTrack({
      preset: p,
      brief: offlinePlan(p).briefs[0],
      apiKey: "k",
      fetchFn: fakeFetch(json),
    });
    expect(t.lyrics).toBe("[Instrumental]");
  });
  it("forced lyrics still strip medical claims (honesty stays blocking)", async () => {
    const json = JSON.stringify({
      style: "bowls",
      exclude: "",
      bpmOrBeatless: "beatless",
      structure: "[Verse]",
      lyrics: "[Verse]\nthis music repairs DNA tonight",
      notes: "",
    });
    const p = getPreset("sound-healing");
    const t = await generateTrack({
      preset: p,
      brief: offlinePlan(p, 4, true).briefs[0],
      forceLyrics: true,
      apiKey: "k",
      fetchFn: fakeFetch(json),
    });
    expect(t.lyrics.toLowerCase()).not.toContain("repairs dna");
  });
  it("planSet forceLyrics injects a sung directive", async () => {
    let body;
    const cap = async (_u, o) => {
      body = JSON.parse(o.body);
      return {
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                arcType: "steady",
                contour: [4, 4, 4, 4],
                briefs: Array.from({ length: 4 }, (_, i) => ({
                  trackIndex: i + 1,
                  arcEnergy: 4,
                  bpmOrBeatless: "70 BPM",
                  vocalDefault: "full-lead",
                  leadTexture: "x",
                  doWords: [],
                  dontWords: [],
                  structureHint: "[Verse]",
                })),
              }),
            },
          ],
        }),
      };
    };
    await planSet({
      preset: getPreset("deep-focus"),
      concept: "x",
      theme: "shipping code",
      forceLyrics: true,
      trackCount: 4,
      apiKey: "k",
      fetchFn: cap,
    });
    expect(body.messages[0].content).toMatch(/sung|lyrics/i);
  });
});

describe("setProgress", () => {
  it("counts pasted/generated/total", () => {
    const set = {
      tracks: [
        { status: "generated", pasted: true },
        { status: "generated" },
        { status: "planned" },
      ],
    };
    expect(setProgress(set)).toEqual({ pasted: 1, generated: 2, total: 3 });
  });
  it("handles an empty/missing tracks array", () => {
    expect(setProgress({})).toEqual({ pasted: 0, generated: 0, total: 0 });
    expect(setProgress(null)).toEqual({ pasted: 0, generated: 0, total: 0 });
  });
});

describe("relativeAge", () => {
  const now = 1_000_000_000_000; // fixed reference instant
  it("returns 'just now' for under a minute", () => {
    expect(relativeAge(now - 30_000, now)).toBe("just now");
  });
  it("formats minutes ago", () => {
    expect(relativeAge(now - 5 * 60_000, now)).toBe("5m ago");
  });
  it("formats hours ago", () => {
    expect(relativeAge(now - 3 * 3_600_000, now)).toBe("3h ago");
  });
  it("formats days ago", () => {
    expect(relativeAge(now - 2 * 86_400_000, now)).toBe("2d ago");
  });
});

describe("phaseLabels", () => {
  it("labels a rising-then-falling arc across all four phases", () => {
    const labels = phaseLabels([3, 5, 6, 7, 8, 8, 6, 4]); // motivation-workout-ish
    expect(labels[0]).toBe("Warm-up");
    expect(labels).toContain("Build");
    expect(labels[4]).toBe("Peak"); // first max
    expect(labels[7]).toBe("Release");
  });
  it("returns a label for every track", () => {
    const c = [6, 7, 7, 8];
    expect(phaseLabels(c)).toHaveLength(c.length);
  });
  it("handles a flat contour without throwing", () => {
    expect(phaseLabels([5, 5, 5])).toHaveLength(3);
  });
  it("returns [] for an empty contour", () => {
    expect(phaseLabels([])).toEqual([]);
  });
});

describe("nudgeBrief", () => {
  it("raises energy and re-derives bpm, immutably", () => {
    const p = getPreset("day-floor-peak"); // range 122-128 → mid 125
    const brief = offlinePlan(p, 8).briefs[0];
    const before = brief.arcEnergy;
    const up = nudgeBrief(brief, +1, p);
    expect(up.arcEnergy).toBe(Math.min(10, before + 1));
    expect(brief.arcEnergy).toBe(before); // original untouched
    expect(up.bpmOrBeatless).toMatch(/125 BPM/);
  });
  it("clamps at 1 and 10", () => {
    const p = getPreset("sleep");
    const b = { ...offlinePlan(p).briefs[0], arcEnergy: 1 };
    expect(nudgeBrief(b, -1, p).arcEnergy).toBe(1);
    const hi = { ...b, arcEnergy: 10 };
    expect(nudgeBrief(hi, +1, p).arcEnergy).toBe(10);
  });
  it("beatless preset stays beatless after a nudge", () => {
    const p = getPreset("meditation"); // beatless
    const b = offlinePlan(p).briefs[0];
    expect(nudgeBrief(b, +1, p).bpmOrBeatless).toMatch(/beatless/i);
  });
});

describe("motifTargets", () => {
  it("returns opener and closer indices", () => {
    expect(motifTargets(8)).toEqual([0, 7]);
  });
  it("dedupes for a 1-track set", () => {
    expect(motifTargets(1)).toEqual([0]);
  });
  it("empty for 0", () => {
    expect(motifTargets(0)).toEqual([]);
  });
});

describe("motif in generation", () => {
  it("planSet passes a given motif as a directive", async () => {
    let body;
    const cap = async (_u, o) => {
      body = JSON.parse(o.body);
      return {
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                arcType: "steady",
                contour: [4, 4, 4, 4],
                motif: "hold the line",
                briefs: Array.from({ length: 4 }, (_, i) => ({
                  trackIndex: i + 1,
                  arcEnergy: 4,
                  bpmOrBeatless: "120 BPM",
                  vocalDefault: "full-lead",
                  leadTexture: "x",
                  doWords: [],
                  dontWords: [],
                  structureHint: "[Verse]",
                })),
              }),
            },
          ],
        }),
      };
    };
    const plan = await planSet({
      preset: getPreset("day-floor-peak"),
      concept: "x",
      motif: "hold the line",
      trackCount: 4,
      apiKey: "k",
      fetchFn: cap,
    });
    expect(body.messages[0].content).toMatch(/motif|recurring/i);
    expect(body.messages[0].content).toContain("hold the line");
    expect(plan.motif).toBe("hold the line");
  });
  it("planSet returns a model-proposed motif when none given", async () => {
    const cap = async () => ({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              arcType: "steady",
              contour: [4, 4, 4, 4],
              motif: "we ride at dawn",
              briefs: Array.from({ length: 4 }, (_, i) => ({
                trackIndex: i + 1,
                arcEnergy: 4,
                bpmOrBeatless: "120 BPM",
                vocalDefault: "full-lead",
                leadTexture: "x",
                doWords: [],
                dontWords: [],
                structureHint: "[Verse]",
              })),
            }),
          },
        ],
      }),
    });
    const plan = await planSet({
      preset: getPreset("day-floor-peak"),
      concept: "x",
      trackCount: 4,
      apiKey: "k",
      fetchFn: cap,
    });
    expect(plan.motif).toBe("we ride at dawn");
  });
  it("generateTrack injects the motif directive on a motif track", async () => {
    let body;
    const cap = async (_u, o) => {
      body = JSON.parse(o.body);
      return {
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                style: "house",
                exclude: "",
                bpmOrBeatless: "124 BPM",
                structure: "[Verse][Chorus]",
                lyrics: "[Chorus]\nhold the line",
                notes: "",
              }),
            },
          ],
        }),
      };
    };
    const p = getPreset("day-floor-peak");
    await generateTrack({
      preset: p,
      brief: offlinePlan(p, 4).briefs[0],
      motif: "hold the line",
      isMotifTrack: true,
      apiKey: "k",
      fetchFn: cap,
    });
    expect(body.messages[0].content).toContain("hold the line");
    expect(body.messages[0].content).toMatch(/motif|reprise|recurring/i);
  });
  it("generateTrack does NOT inject motif on a non-motif track", async () => {
    let body;
    const cap = async (_u, o) => {
      body = JSON.parse(o.body);
      return {
        ok: true,
        json: async () => ({
          content: [
            {
              text: JSON.stringify({
                style: "house",
                exclude: "",
                bpmOrBeatless: "124 BPM",
                structure: "[Verse]",
                lyrics: "[Verse]\nx",
                notes: "",
              }),
            },
          ],
        }),
      };
    };
    const p = getPreset("day-floor-peak");
    await generateTrack({
      preset: p,
      brief: offlinePlan(p, 4).briefs[1],
      motif: "hold the line",
      isMotifTrack: false,
      apiKey: "k",
      fetchFn: cap,
    });
    expect(body.messages[0].content).not.toContain("hold the line");
  });
});
