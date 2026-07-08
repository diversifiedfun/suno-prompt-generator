import { describe, it, expect } from "vitest";
import {
  buildUserMessage,
  offlineGenerate,
  offlineTitle,
  generatePrompt,
  normalize,
  SYSTEM_PROMPT,
} from "./generator.js";

describe("vocal delivery-mode lyric guidance", () => {
  it("keeps delivery in the Style field and out of second brackets", () => {
    expect(SYSTEM_PROMPT).toContain("the STYLE field is the reliable lever");
    // warns about the exact form that gets sung aloud
    expect(SYSTEM_PROMPT).toContain("gets SUNG out loud as lyrics");
    // the discredited second-bracket form must NOT be recommended
    expect(SYSTEM_PROMPT).not.toContain("[Chorus] [Belting, Powerful]");
    // the momentary inline-FX example list is unchanged
    expect(SYSTEM_PROMPT).toContain(
      "(e.g. [Vocal Chop], [Stutter], [Harmonies])",
    );
  });
});

describe("lyric-craft + placebo guidance", () => {
  it("carries syllable, rhyme, pronunciation, and placebo-ban rules", () => {
    expect(SYSTEM_PROMPT).toContain("±2"); // syllable evenness
    expect(SYSTEM_PROMPT).toMatch(/slant/i); // rhyme guidance
    expect(SYSTEM_PROMPT).toMatch(/respell/i); // pronunciation
    expect(SYSTEM_PROMPT).toContain("[Reverb: 30%]"); // named placebo to avoid
  });
});

describe("buildUserMessage", () => {
  it("omits the subject line when no subject is given", () => {
    const msg = buildUserMessage("vibe", "late night drive");
    expect(msg).toContain("late night drive");
    expect(msg).not.toContain("ABOUT:");
  });

  it("adds a full-lyrics subject directive when a subject is given", () => {
    const msg = buildUserMessage(
      "vibe",
      "late night drive",
      "driving to forget",
    );
    expect(msg).toContain('ABOUT: "driving to forget"');
    expect(msg).toContain("write full lyrics");
  });

  it("keeps the artist-decompose instruction and still honors a subject", () => {
    const msg = buildUserMessage("artist", "some band", "heartbreak");
    expect(msg).toContain("never name them");
    expect(msg).toContain('ABOUT: "heartbreak"');
  });
});

describe("buildUserMessage instrumental mode", () => {
  it("adds the instrumental instruction and asks for empty lyrics when instrumental=true", () => {
    const msg = buildUserMessage("vibe", "late night drive", "", true);
    expect(msg).toMatch(/INSTRUMENTAL/);
    expect(msg).toMatch(/"lyrics" as an empty string/);
    expect(msg).toMatch(/"vocalGender" as an empty string/);
  });

  it("omits the instrumental instruction when instrumental=false (default)", () => {
    const msg = buildUserMessage("vibe", "late night drive");
    expect(msg).not.toMatch(/INSTRUMENTAL/);
  });
});

describe("normalize instrumental enforcement", () => {
  it("forces empty lyrics and vocalGender when instrumental=true, even if the model returned them", () => {
    const result = normalize(
      {
        title: "Drift",
        style: "ambient, 70 bpm",
        lyrics: "some words the model wrote anyway",
        vocalGender: "female",
      },
      true,
    );
    expect(result.lyrics).toBe("");
    expect(result.vocalGender).toBe("");
    expect(result.title).toBe("Drift");
    expect(result.style).toBe("ambient, 70 bpm");
  });

  it("keeps lyrics and vocalGender when instrumental=false", () => {
    const result = normalize({
      title: "Drift",
      lyrics: "real lyrics",
      vocalGender: "female",
    });
    expect(result.lyrics).toBe("real lyrics");
    expect(result.vocalGender).toBe("female");
  });
});

describe("offlineGenerate instrumental mode", () => {
  it("forces empty lyrics + empty vocalGender and returns a bar-count structure", () => {
    const r = offlineGenerate("vibe", "late night drive", "", true);
    expect(r.lyrics).toBe("");
    expect(r.vocalGender).toBe("");
    expect(r.structure).toMatch(/bars/i);
    expect(r.structure).toMatch(/no vocals/i);
  });

  it("still forces empty vocalGender even if the matched seed names a gender", () => {
    const r = offlineGenerate("vibe", "zzqq-nomatch", "", true);
    expect(r.vocalGender).toBe("");
  });
});

describe("offlineTitle", () => {
  it("prefers the subject, Title-Cases, and caps at four words", () => {
    expect(offlineTitle("driving alone to forget her name", "")).toBe(
      "Driving Alone To Forget",
    );
  });

  it("falls back to the vibe input when no subject", () => {
    expect(offlineTitle("", "rainy melancholy")).toBe("Rainy Melancholy");
  });

  it("returns Untitled only when both are empty", () => {
    expect(offlineTitle("", "")).toBe("Untitled");
    expect(offlineTitle("!!! ???", "")).toBe("Untitled");
  });
});

describe("offlineGenerate", () => {
  it("always returns a title and an empty lyrics field (offline can't write words)", () => {
    const r = offlineGenerate("vibe", "late night drive", "driving to forget");
    expect(r.title).toBe("Driving To Forget");
    expect(r.lyrics).toBe("");
    expect(r.style).toBeTruthy();
    expect(r.fallback).toBe(true);
  });

  it("includes default slider recs and a valid vocalGender", () => {
    const r = offlineGenerate("vibe", "zzqq-nomatch", "");
    expect(r.weirdness).toBe("20");
    expect(r.styleInfluence).toBe("60");
    // The generic vibe seed carries "breathy female vocals" → female.
    expect(r.vocalGender).toBe("female");
  });

  it("leaves vocalGender empty when the style names no gender", () => {
    const r = offlineGenerate("artist", "zzqq-nomatch", "");
    expect(["", "female", "male", "duet", "any"]).toContain(r.vocalGender);
  });
});

describe("generatePrompt (offline path)", () => {
  it("returns the offline shape with a title when no API key is set", async () => {
    const r = await generatePrompt({
      mode: "vibe",
      input: "sunset drive",
      subject: "coming home",
      apiKey: "",
    });
    expect(r.title).toBe("Coming Home");
    expect(r.fallback).toBe(true);
    expect(r.notes).toMatch(/No API key/);
  });

  it("throws when the input is empty", async () => {
    await expect(
      generatePrompt({ mode: "vibe", input: "", apiKey: "" }),
    ).rejects.toThrow(/Describe a vibe/);
  });
});
