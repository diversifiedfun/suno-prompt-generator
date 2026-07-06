import { describe, it, expect, beforeEach } from "vitest";
import { installChromeMock } from "./test/chrome-mock.js";
import {
  createAlbum,
  getAllAlbums,
  getAlbum,
  updateAlbum,
  deleteAlbum,
} from "./album-storage.js";

beforeEach(() => installChromeMock());

describe("album-storage", () => {
  it("creates an album with defaults and a uuid", async () => {
    const a = await createAlbum({ seed: "neon rain", mode: "cohesive" });
    expect(a.id).toBeTruthy();
    expect(a.mode).toBe("cohesive");
    expect(a.trackCount).toBe(10);
    expect(a.tracks).toEqual([]);
    expect(a.title).toBe("Untitled album");
  });

  it("coerces an unknown mode and clamps track count", async () => {
    const a = await createAlbum({ seed: "x", mode: "banana", trackCount: 99 });
    expect(a.mode).toBe("cohesive");
    expect(a.trackCount).toBe(20);
  });

  it("lists newest-first and round-trips through getAlbum", async () => {
    const a = await createAlbum({ title: "A", seed: "a" });
    const b = await createAlbum({ title: "B", seed: "b" });
    expect((await getAlbum(a.id)).title).toBe("A");
    const all = await getAllAlbums();
    expect(all[0].id).toBe(b.id);
  });

  it("updateAlbum merges immutably and never mutates the stored object", async () => {
    const a = await createAlbum({ title: "X", seed: "x" });
    const snapshot = { ...a };
    await updateAlbum(a.id, { title: "Y" });
    expect((await getAlbum(a.id)).title).toBe("Y");
    expect(snapshot.title).toBe("X"); // original untouched
  });

  it("deletes by id", async () => {
    const a = await createAlbum({ seed: "x" });
    await deleteAlbum(a.id);
    expect(await getAlbum(a.id)).toBeNull();
  });
});
