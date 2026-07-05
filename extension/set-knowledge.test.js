import { describe, it, expect } from "vitest";
import {
  PRESETS,
  getPreset,
  validatePreset,
  SET_GENRE_TRAPS,
  OCCASIONS,
  getOccasion,
  occasionSentence,
  blanksToPlanParams,
} from "./set-knowledge.js";

describe("set-knowledge presets", () => {
  it("ships 13 presets: 4 party + 9 wellness", () => {
    expect(PRESETS).toHaveLength(13);
    expect(PRESETS.filter((p) => p.family === "party")).toHaveLength(4);
    expect(PRESETS.filter((p) => p.family === "wellness")).toHaveLength(9);
  });

  it("every preset passes schema validation", () => {
    for (const p of PRESETS) {
      expect(validatePreset(p), `preset ${p.key}`).toEqual([]);
    }
  });

  it("preset keys are unique", () => {
    const keys = PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("defaultContour length matches an 8-track set for every preset", () => {
    for (const p of PRESETS) {
      expect(p.defaultContour.length, p.key).toBe(8);
    }
  });

  it("sound-healing carries a claimGuard blocking medical claims", () => {
    const heal = getPreset("sound-healing");
    expect(heal).toBeTruthy();
    expect(heal.claimGuard).toEqual(
      expect.arrayContaining(["repairs DNA", "entrains your brain"]),
    );
  });

  it("sleep offers a mood subChoice (major/Dorian vs minor), no hard default", () => {
    const sleep = getPreset("sleep");
    const mood = sleep.subChoices.find((s) => s.key === "mood");
    expect(mood.options).toHaveLength(2);
  });

  it("deep-focus bans [Chorus] in its structurePolicy", () => {
    expect(getPreset("deep-focus").structurePolicy.ban).toContain("[Chorus]");
  });

  it("adds the focus rain/ocean SFX genre trap", () => {
    expect(SET_GENRE_TRAPS["Lo-fi instrumental"].fix).toMatch(
      /no rain\/ocean/i,
    );
  });

  it("validatePreset flags a bad preset", () => {
    expect(validatePreset({ key: "x" }).length).toBeGreaterThan(0);
  });
});

describe("occasions", () => {
  it("has exactly one occasion row per preset", () => {
    expect(OCCASIONS).toHaveLength(PRESETS.length);
    for (const p of PRESETS) expect(getOccasion(p.key)).toBeTruthy();
  });
  it("every occasion has an emoji, label and a valid group", () => {
    for (const o of OCCASIONS) {
      expect(o.emoji).toBeTruthy();
      expect(o.label).toBeTruthy();
      expect(["move", "calm"]).toContain(o.group);
    }
  });
});

describe("occasionSentence", () => {
  it("vocal occasionSentence is now sound-only (no about blank)", () => {
    const slots = occasionSentence(getPreset("day-floor-peak"))
      .parts.filter((p) => typeof p === "object")
      .map((p) => p.slot);
    expect(slots).toContain("vibe1");
    expect(slots).not.toContain("about");
  });
  it("instrumental preset has NO 'about' blank", () => {
    const s = occasionSentence(getPreset("deep-focus"));
    expect(s.category).toBe("instrumental");
    const slots = s.parts
      .filter((p) => typeof p === "object")
      .map((p) => p.slot);
    expect(slots).not.toContain("about");
  });
  it("no blank is left without a default", () => {
    for (const p of PRESETS)
      for (const part of occasionSentence(p).parts)
        if (typeof part === "object") expect(part.default).toBeTruthy();
  });
});

describe("blanksToPlanParams", () => {
  it("maps vocal blanks: vibes→sound, no theme", () => {
    const r = blanksToPlanParams(getPreset("day-floor-peak"), {
      vibe1: "funky",
      vibe2: "filthy",
    });
    expect(r.vibe).toEqual(["funky", "filthy"]);
    expect(r.theme).toBeUndefined();
    expect(r.scene).toBe("");
  });
  it("maps instrumental blanks: texture→scene, mood→vibe, no theme", () => {
    const r = blanksToPlanParams(getPreset("deep-focus"), {
      texture: "warm rhodes",
      mood: "steady",
    });
    expect(r.scene).toBe("warm rhodes");
    expect(r.vibe).toEqual(["steady"]);
    expect(r.theme).toBe("");
  });
  it("blanksToPlanParams no longer emits theme", () => {
    const r = blanksToPlanParams(getPreset("day-floor-peak"), {
      vibe1: "funky",
      vibe2: "filthy",
    });
    expect(r.vibe).toEqual(["funky", "filthy"]);
    expect(r.theme).toBeUndefined();
    expect(r.scene).toBe("");
  });
});

describe("deep-focus lyric warning", () => {
  it("deep-focus carries a lyric warning", () => {
    expect(getPreset("deep-focus").lyricWarn).toBeTruthy();
  });
});
