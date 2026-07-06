import { describe, it, expect } from "vitest";
import {
  buildUserMessage,
  offlineGenerate,
  offlineTitle,
  generatePrompt,
} from "./generator.js";

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
