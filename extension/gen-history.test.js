import { describe, it, expect, beforeEach } from "vitest";
import { installChromeMock } from "./test/chrome-mock.js";
import {
  addGeneration,
  getAllGenerations,
  toggleStar,
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

  it("evicts the oldest record when a 501st is added, keeping count at 500", async () => {
    const first = await addGeneration({
      mode: "vibe",
      input: "gen-0",
      result: FULL_RESULT,
    });
    for (let i = 1; i < 500; i++) {
      await addGeneration({
        mode: "vibe",
        input: `gen-${i}`,
        result: FULL_RESULT,
      });
    }
    let all = await getAllGenerations();
    expect(all).toHaveLength(500);
    expect(all.some((r) => r.id === first.id)).toBe(true);

    const next = await addGeneration({
      mode: "vibe",
      input: "gen-500",
      result: FULL_RESULT,
    });
    all = await getAllGenerations();
    expect(all).toHaveLength(500);
    expect(all.some((r) => r.id === first.id)).toBe(false);
    expect(all.some((r) => r.id === next.id)).toBe(true);
  });

  it("toggleStar flips the starred flag on a record", async () => {
    const a = await addGeneration({
      mode: "vibe",
      input: "A",
      result: FULL_RESULT,
    });
    expect(a.starred).toBe(false);
    const starred = await toggleStar(a.id);
    expect(starred.starred).toBe(true);
    expect((await getAllGenerations())[0].starred).toBe(true);
    const unstarred = await toggleStar(a.id);
    expect(unstarred.starred).toBe(false);
  });

  it("exempts starred records from the cap — they are never evicted", async () => {
    // Star the very first (oldest) record, then flood past the cap.
    const pinned = await addGeneration({
      mode: "vibe",
      input: "pinned",
      result: FULL_RESULT,
    });
    await toggleStar(pinned.id);
    for (let i = 0; i < 500; i++) {
      await addGeneration({
        mode: "vibe",
        input: `flood-${i}`,
        result: FULL_RESULT,
      });
    }
    const all = await getAllGenerations();
    // 500 newest unstarred + the 1 pinned survivor = 501.
    expect(all).toHaveLength(501);
    const survivor = all.find((r) => r.id === pinned.id);
    expect(survivor).toBeTruthy();
    expect(survivor.starred).toBe(true);
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
