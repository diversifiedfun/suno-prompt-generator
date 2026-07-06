import { describe, it, expect, beforeEach } from "vitest";
import { installChromeMock } from "./test/chrome-mock.js";
import {
  createSet,
  getAllSets,
  getSet,
  updateSet,
  deleteSet,
  getFormDraft,
  saveFormDraft,
} from "./set-storage.js";

beforeEach(() => installChromeMock());

describe("set-storage", () => {
  it("creates a set with defaults and a uuid", async () => {
    const s = await createSet({
      title: "Nap",
      presetKey: "sleep",
      maturity: "sourced",
      concept: "rainy afternoon",
    });
    expect(s.id).toBeTruthy();
    expect(s.presetKey).toBe("sleep");
    expect(s.tracks).toEqual([]);
    expect(s.conversation).toEqual([]);
    expect(s.activeTrackIndex).toBe(0);
    expect(s.createdAt).toBeGreaterThan(0);
  });

  it("round-trips through getSet and lists newest-first", async () => {
    const a = await createSet({ title: "A", presetKey: "sleep" });
    const b = await createSet({ title: "B", presetKey: "meditation" });
    expect((await getSet(a.id)).title).toBe("A");
    const all = await getAllSets();
    expect(all[0].id).toBe(b.id); // newest first
  });

  it("updateSet merges immutably and never mutates the stored object", async () => {
    const s = await createSet({ title: "X", presetKey: "sleep" });
    const before = await getSet(s.id);
    const updated = await updateSet(s.id, { title: "Y", contour: [1, 2] });
    expect(updated.title).toBe("Y");
    expect(updated.id).toBe(s.id);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
    expect(before.title).toBe("X"); // original snapshot untouched
  });

  it("deleteSet removes it", async () => {
    const s = await createSet({ title: "Z", presetKey: "sleep" });
    await deleteSet(s.id);
    expect(await getSet(s.id)).toBeNull();
  });

  it("sets live under set_ keys, isolated from prompt_ keys", async () => {
    const store = installChromeMock();
    const s = await createSet({ title: "Iso", presetKey: "sleep" });
    expect([...store.keys()]).toEqual([`set_${s.id}`]);
  });

  describe("form draft", () => {
    it("returns null when no draft saved", async () => {
      expect(await getFormDraft()).toBeNull();
    });

    it("round-trips the chosen form fields", async () => {
      await saveFormDraft({
        presetKey: "sleep",
        mode: "story",
        vibe: ["dreamy", "warm"],
        theme: "ocean",
        scene: "rainy afternoon",
        keywords: "letting go",
        story: "a slow day by the water",
        freeVibe: "sunset rooftop",
        feelings: "dreamy, warm",
        genres: ["Lo-fi house", "Deep house"],
        subChoices: { tempo: "slow" },
      });
      const d = await getFormDraft();
      expect(d).toEqual({
        presetKey: "sleep",
        mode: "story",
        vibe: ["dreamy", "warm"],
        theme: "ocean",
        scene: "rainy afternoon",
        keywords: "letting go",
        story: "a slow day by the water",
        freeVibe: "sunset rooftop",
        feelings: "dreamy, warm",
        genres: ["Lo-fi house", "Deep house"],
        subChoices: { tempo: "slow" },
        runtimeMin: 60,
        trackLength: "standard",
        trackCount: 8,
        countOverride: null,
        blanks: {},
      });
    });

    it("normalizes missing fields to safe defaults", async () => {
      await saveFormDraft({ presetKey: "sleep" });
      expect(await getFormDraft()).toEqual({
        presetKey: "sleep",
        mode: "quick",
        vibe: [],
        theme: "",
        scene: "",
        keywords: "",
        story: "",
        freeVibe: "",
        feelings: "",
        genres: [],
        subChoices: {},
        runtimeMin: 60,
        trackLength: "standard",
        trackCount: 8,
        countOverride: null,
        blanks: {},
      });
    });

    it("saving overwrites the prior draft", async () => {
      await saveFormDraft({ presetKey: "sleep", scene: "first" });
      await saveFormDraft({ presetKey: "focus", scene: "second" });
      const d = await getFormDraft();
      expect(d.presetKey).toBe("focus");
      expect(d.scene).toBe("second");
    });

    it("draft key does not start with set_ so getAllSets ignores it", async () => {
      const store = installChromeMock();
      await saveFormDraft({ presetKey: "sleep", scene: "hi" });
      expect([...store.keys()].some((k) => k.startsWith("set_"))).toBe(false);
      expect(await getAllSets()).toEqual([]);
    });
  });
});

describe("forceLyrics", () => {
  it("createSet stores forceLyrics (default false)", async () => {
    expect((await createSet({ presetKey: "sleep" })).forceLyrics).toBe(false);
    expect(
      (await createSet({ presetKey: "sleep", forceLyrics: true })).forceLyrics,
    ).toBe(true);
  });
});

describe("motif", () => {
  it("createSet stores motif (default empty)", async () => {
    expect((await createSet({ presetKey: "sleep" })).motif).toBe("");
    expect(
      (await createSet({ presetKey: "sleep", motif: "hold the line" })).motif,
    ).toBe("hold the line");
  });
});

describe("trackCount / trackLength", () => {
  it("createSet stores trackCount and trackLength with sane defaults", async () => {
    const a = await createSet({ presetKey: "sleep" });
    expect(a.trackCount).toBe(8);
    expect(a.trackLength).toBe("standard");
    const b = await createSet({
      presetKey: "sleep",
      trackCount: 12,
      trackLength: "dj-long",
    });
    expect(b.trackCount).toBe(12);
    expect(b.trackLength).toBe("dj-long");
  });
  it("saveFormDraft round-trips the new intake fields", async () => {
    await saveFormDraft({
      presetKey: "day-floor-peak",
      runtimeMin: 60,
      trackLength: "dj-long",
      trackCount: 8,
      countOverride: 12,
      blanks: { vibe1: "funky", vibe2: "filthy", about: "the crowd" },
    });
    const d = await getFormDraft();
    expect(d.runtimeMin).toBe(60);
    expect(d.trackLength).toBe("dj-long");
    expect(d.trackCount).toBe(8);
    expect(d.countOverride).toBe(12);
    expect(d.blanks.about).toBe("the crowd");
  });
  it("countOverride defaults to null when omitted", async () => {
    await saveFormDraft({ presetKey: "sleep" });
    expect((await getFormDraft()).countOverride).toBeNull();
  });
});
