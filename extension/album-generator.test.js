import { describe, it, expect } from "vitest";
import {
  clampCount,
  offlineAlbumPlan,
  offlineAlbumTrack,
  planAlbum,
  generateAlbumTrack,
  TRACK_SYSTEM,
} from "./album-generator.js";

describe("vocal delivery-mode lyric guidance", () => {
  it("routes delivery modes to tested section-header tags, not inline cues", () => {
    expect(TRACK_SYSTEM).toContain("the STYLE field is the reliable lever");
    expect(TRACK_SYSTEM).toContain("gets SUNG out loud as lyrics");
    expect(TRACK_SYSTEM).not.toContain("[Chorus] [Belting, Powerful]");
    // delivery modes are NOT offered as momentary inline FX
    expect(TRACK_SYSTEM).toContain("[Vocal Chop], [Harmonies]");
  });

  it("carries lyric-craft + placebo-ban rules", () => {
    expect(TRACK_SYSTEM).toContain("±2");
    expect(TRACK_SYSTEM).toMatch(/slant/i);
    expect(TRACK_SYSTEM).toContain("[Reverb: 30%]");
  });
});

describe("clampCount", () => {
  it("clamps to 3..20 and defaults to 10", () => {
    expect(clampCount(1)).toBe(3);
    expect(clampCount(99)).toBe(20);
    expect(clampCount(12)).toBe(12);
    expect(clampCount("x")).toBe(10);
  });
});

describe("offlineAlbumPlan", () => {
  it("cohesive mode: N tracks, opener first and closer last", () => {
    const p = offlineAlbumPlan("neon rain", "vibe", "cohesive", 10);
    expect(p.tracks).toHaveLength(10);
    expect(p.tracks[0].role).toBe("opener");
    expect(p.tracks[9].role).toBe("closer");
    expect(p.soundDNA).toContain("neon rain");
  });
  it("concept mode: every track is a chapter", () => {
    const p = offlineAlbumPlan("a road trip", "vibe", "concept", 5);
    expect(p.tracks).toHaveLength(5);
    expect(p.tracks.every((t) => /chapter/.test(t.role))).toBe(true);
  });
  it("artist seed keeps the name out of the soundDNA AND the title", () => {
    const p = offlineAlbumPlan("Radiohead", "artist", "cohesive", 8);
    expect(p.soundDNA.toLowerCase()).not.toContain("radiohead");
    expect(p.albumTitle.toLowerCase()).not.toContain("radiohead");
  });
  it("vibe seed is fine to reuse as the album title", () => {
    const p = offlineAlbumPlan("neon rain", "vibe", "cohesive", 6);
    expect(p.albumTitle).toBe("neon rain");
  });
});

describe("offlineAlbumTrack", () => {
  it("uses the album soundDNA as the style (cohesion) and the slot title", () => {
    const album = {
      soundDNA: "dream pop, warm analog, breathy vocals",
      exclude: "",
    };
    const t = offlineAlbumTrack(album, {
      trackTitle: "Taillights",
      role: "opener",
    });
    expect(t.title).toBe("Taillights");
    expect(t.style).toBe("dream pop, warm analog, breathy vocals");
  });
});

describe("planAlbum", () => {
  it("without an API key returns an offline outline", async () => {
    const p = await planAlbum({ seed: "x", trackCount: 6, apiKey: "" });
    expect(p.offline).toBe(true);
    expect(p.tracks).toHaveLength(6);
  });

  it("with a key, parses the model's JSON into a normalized plan", async () => {
    const fetchFn = async () => ({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              albumTitle: "Neon Afterhours",
              soundDNA: "synthwave, 1980s gated reverb, analog pads",
              exclude: "harsh EDM leads",
              tracks: [
                { trackTitle: "Taillights", role: "opener", angle: "leaving" },
                { trackTitle: "Static Kiss", role: "single", angle: "a spark" },
              ],
            }),
          },
        ],
      }),
    });
    const p = await planAlbum({
      seed: "late night neon drive",
      trackCount: 2,
      apiKey: "k",
      fetchFn,
    });
    expect(p.offline).toBeFalsy();
    expect(p.albumTitle).toBe("Neon Afterhours");
    expect(p.tracks).toHaveLength(2);
    expect(p.tracks[0].trackTitle).toBe("Taillights");
  });

  it("online: an omitted albumTitle never leaks a raw artist seed", async () => {
    const fetchFn = async () => ({
      ok: true,
      json: async () => ({
        content: [
          {
            text: JSON.stringify({
              albumTitle: "", // model omitted it
              soundDNA: "art rock, layered guitars, falsetto",
              tracks: [
                { trackTitle: "One", role: "opener", angle: "a" },
                { trackTitle: "Two", role: "closer", angle: "b" },
              ],
            }),
          },
        ],
      }),
    });
    const p = await planAlbum({
      seed: "Radiohead",
      seedMode: "artist",
      trackCount: 2,
      apiKey: "k",
      fetchFn,
    });
    expect(p.albumTitle.toLowerCase()).not.toContain("radiohead");
    expect(p.albumTitle).toBe("Untitled album");
  });
});

describe("generateAlbumTrack", () => {
  it("without a key returns an offline track carrying the soundDNA", async () => {
    const album = {
      soundDNA: "boom bap, dusty samples",
      exclude: "",
      mode: "cohesive",
    };
    const t = await generateAlbumTrack({
      album,
      brief: { trackTitle: "Dust", role: "deep cut", angle: "" },
      apiKey: "",
    });
    expect(t.style).toBe("boom bap, dusty samples");
    expect(t.title).toBe("Dust");
  });
});
