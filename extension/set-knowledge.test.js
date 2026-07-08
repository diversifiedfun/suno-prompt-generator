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
  ENERGY,
  TEXTURE,
  ARRANGEMENT,
  PERCUSSION,
  PEAK,
  VOCAL,
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

describe("new mad-lib word pools", () => {
  it("exports curated ENERGY/TEXTURE/ARRANGEMENT/PERCUSSION/PEAK/VOCAL pools", () => {
    for (const pool of [
      ENERGY,
      TEXTURE,
      ARRANGEMENT,
      PERCUSSION,
      PEAK,
      VOCAL,
    ]) {
      expect(Array.isArray(pool)).toBe(true);
      expect(pool.length).toBeGreaterThanOrEqual(6);
      for (const word of pool) expect(typeof word).toBe("string");
    }
  });
});

describe("occasionSentence — richer templates with dropdowns", () => {
  it("instrumental preset returns select-control blanks with the expected slots + pools", () => {
    const s = occasionSentence(getPreset("deep-focus-house"));
    expect(s.category).toBe("instrumental");
    const blanks = s.parts.filter((p) => typeof p === "object");
    const bySlot = Object.fromEntries(blanks.map((b) => [b.slot, b]));
    expect(Object.keys(bySlot).sort()).toEqual(
      [
        "arrangement",
        "energy",
        "peak",
        "percussion",
        "texture",
        "texture2",
      ].sort(),
    );
    expect(bySlot.energy.pool).toBe("ENERGY");
    expect(bySlot.texture.pool).toBe("TEXTURE");
    expect(bySlot.texture2.pool).toBe("TEXTURE");
    expect(bySlot.arrangement.pool).toBe("ARRANGEMENT");
    expect(bySlot.percussion.pool).toBe("PERCUSSION");
    expect(bySlot.peak.pool).toBe("PEAK");
    for (const b of blanks) {
      expect(b.control).toBe("select");
      expect(b.default).toBeTruthy();
    }
  });

  it("vocal preset (chant/full-lead) returns select-control blanks with the expected slots + pools", () => {
    const s = occasionSentence(getPreset("day-floor-peak"));
    expect(s.category).toBe("vocal");
    const blanks = s.parts.filter((p) => typeof p === "object");
    const bySlot = Object.fromEntries(blanks.map((b) => [b.slot, b]));
    expect(Object.keys(bySlot).sort()).toEqual(
      ["energy", "mood", "peak", "percussion", "vocal"].sort(),
    );
    expect(bySlot.energy.pool).toBe("ENERGY");
    expect(bySlot.vocal.pool).toBe("VOCAL");
    expect(bySlot.mood.pool).toBe("MOOD");
    expect(bySlot.percussion.pool).toBe("PERCUSSION");
    expect(bySlot.peak.pool).toBe("PEAK");
    for (const b of blanks) {
      expect(b.control).toBe("select");
      expect(b.default).toBeTruthy();
    }
  });

  it("seeds defaults from preset.doWords when a doWord matches the pool (deep-focus-house → hypnotic/submerged)", () => {
    const s = occasionSentence(getPreset("deep-focus-house"));
    const bySlot = Object.fromEntries(
      s.parts.filter((p) => typeof p === "object").map((b) => [b.slot, b]),
    );
    expect(bySlot.energy.default).toBe("hypnotic");
    expect(bySlot.texture.default).toBe("submerged");
  });

  it("instrumental preset has no 'about' blank", () => {
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

describe("blanksToPlanParams — new slots", () => {
  it("maps instrumental blanks: texture/texture2/arrangement/percussion→scene, energy→vibe", () => {
    const r = blanksToPlanParams(getPreset("deep-focus-house"), {
      energy: "hypnotic",
      texture: "submerged",
      texture2: "glassy",
      arrangement: "synth-led",
      percussion: "dub bass",
      peak: "a slow dissolve",
    });
    expect(r.scene).toContain("submerged");
    expect(r.scene).toContain("glassy");
    expect(r.scene).toContain("synth-led");
    expect(r.scene).toContain("dub bass");
    expect(r.vibe).toEqual(["hypnotic"]);
    expect(r.theme).toBe("");
  });

  it("maps vocal blanks: energy+mood→vibe, vocal+percussion→scene, no theme", () => {
    const r = blanksToPlanParams(getPreset("day-floor-peak"), {
      energy: "driving",
      vocal: "soaring",
      mood: "Euphoric",
      percussion: "four-on-the-floor",
      peak: "a euphoric peak",
    });
    expect(r.vibe).toEqual(["driving", "Euphoric"]);
    expect(r.scene).toContain("soaring");
    expect(r.scene).toContain("four-on-the-floor");
    expect(r.theme).toBeUndefined();
  });
});

describe("deep-focus lyric warning", () => {
  it("deep-focus carries a lyric warning", () => {
    expect(getPreset("deep-focus").lyricWarn).toBeTruthy();
  });
});
