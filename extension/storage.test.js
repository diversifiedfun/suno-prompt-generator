import { describe, it, expect, beforeEach } from "vitest";
import { installChromeMock } from "./test/chrome-mock.js";
import {
  addVibe,
  getAllVibes,
  deleteVibe,
  getUiState,
  saveUiState,
} from "./storage.js";

beforeEach(() => installChromeMock());

describe("saved vibes", () => {
  it("adds a vibe seed with a uuid and normalized fields", async () => {
    const v = await addVibe({
      name: "  Midnight Drive  ",
      reference: "synthwave, someone left",
      subject: "driving to forget",
      mode: "vibe",
    });
    expect(v.id).toBeTruthy();
    expect(v.name).toBe("Midnight Drive");
    expect(v.mode).toBe("vibe");
    expect(v.createdAt).toBeGreaterThan(0);
  });

  it("coerces an unknown mode to vibe", async () => {
    const v = await addVibe({ reference: "x", mode: "banana" });
    expect(v.mode).toBe("vibe");
  });

  it("lists newest-first and deletes by id", async () => {
    const a = await addVibe({ name: "A", reference: "a" });
    const b = await addVibe({ name: "B", reference: "b" });
    let all = await getAllVibes();
    expect(all.map((v) => v.name)).toEqual(["B", "A"]);
    await deleteVibe(a.id);
    all = await getAllVibes();
    expect(all.map((v) => v.name)).toEqual(["B"]);
    expect(all.some((v) => v.id === b.id)).toBe(true);
  });
});

describe("ui state", () => {
  it("returns an empty object when nothing is stored", async () => {
    expect(await getUiState()).toEqual({});
  });

  it("round-trips a whole-object save", async () => {
    await saveUiState({ activeTab: "build", gen: { input: "hi" } });
    const s = await getUiState();
    expect(s.activeTab).toBe("build");
    expect(s.gen.input).toBe("hi");
  });

  it("replaces rather than merges (caller owns the shape)", async () => {
    await saveUiState({ activeTab: "set", build: { genre: "house" } });
    await saveUiState({ activeTab: "library" });
    const s = await getUiState();
    expect(s.activeTab).toBe("library");
    expect(s.build).toBeUndefined();
  });
});
