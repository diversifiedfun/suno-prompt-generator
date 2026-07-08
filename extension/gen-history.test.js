import { describe, it, expect, beforeEach } from "vitest";
import { installChromeMock } from "./test/chrome-mock.js";
import {
  addGeneration,
  getAllGenerations,
  deleteGeneration,
  clearGenerations,
} from "./gen-history.js";

beforeEach(() => installChromeMock());

const FULL_RESULT = {
  title: "Neon Drive",
  style: "synthwave, melancholy, driving beat",
  exclude: "screaming, distortion",
  bpm: 110,
  vocalGender: "female",
  weirdness: 30,
  styleInfluence: 55,
  structure: "[Verse]\n[Chorus]",
  lyrics: "driving through the neon rain",
  notes: "",
  variants: [],
  fallback: false,
};

describe("generation history", () => {
  it("stores a retrievable record with the full result", async () => {
    const record = await addGeneration({
      mode: "vibe",
      input: "late night neon drive",
      subject: "driving to forget",
      instrumental: false,
      result: FULL_RESULT,
    });
    expect(record.id).toBeTruthy();
    expect(record.createdAt).toBeGreaterThan(0);
    expect(record.mode).toBe("vibe");
    expect(record.input).toBe("late night neon drive");
    expect(record.subject).toBe("driving to forget");
    expect(record.instrumental).toBe(false);
    expect(record.result).toEqual(FULL_RESULT);

    const all = await getAllGenerations();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(record.id);
    expect(all[0].result).toEqual(FULL_RESULT);
  });

  it("lists newest-first", async () => {
    const a = await addGeneration({
      mode: "vibe",
      input: "A",
      result: FULL_RESULT,
    });
    const b = await addGeneration({
      mode: "artist",
      input: "B",
      result: FULL_RESULT,
    });
    const all = await getAllGenerations();
    expect(all.map((r) => r.id)).toEqual([b.id, a.id]);
  });

  it("evicts the oldest record when a 51st is added, keeping count at 50", async () => {
    const first = await addGeneration({
      mode: "vibe",
      input: "gen-0",
      result: FULL_RESULT,
    });
    for (let i = 1; i < 50; i++) {
      await addGeneration({
        mode: "vibe",
        input: `gen-${i}`,
        result: FULL_RESULT,
      });
    }
    let all = await getAllGenerations();
    expect(all).toHaveLength(50);
    expect(all.some((r) => r.id === first.id)).toBe(true);

    const fifty1st = await addGeneration({
      mode: "vibe",
      input: "gen-50",
      result: FULL_RESULT,
    });
    all = await getAllGenerations();
    expect(all).toHaveLength(50);
    expect(all.some((r) => r.id === first.id)).toBe(false);
    expect(all.some((r) => r.id === fifty1st.id)).toBe(true);
  });

  it("deletes a single record by id", async () => {
    const a = await addGeneration({
      mode: "vibe",
      input: "A",
      result: FULL_RESULT,
    });
    const b = await addGeneration({
      mode: "vibe",
      input: "B",
      result: FULL_RESULT,
    });
    await deleteGeneration(a.id);
    const all = await getAllGenerations();
    expect(all.map((r) => r.id)).toEqual([b.id]);
  });

  it("clears all generation history records", async () => {
    await addGeneration({ mode: "vibe", input: "A", result: FULL_RESULT });
    await addGeneration({ mode: "vibe", input: "B", result: FULL_RESULT });
    await clearGenerations();
    const all = await getAllGenerations();
    expect(all).toHaveLength(0);
  });
});
