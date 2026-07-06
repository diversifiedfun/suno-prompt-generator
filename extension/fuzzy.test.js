import { describe, it, expect } from "vitest";
import {
  isSubsequence,
  editDistance,
  scoreMatch,
  rankSuggestions,
} from "./fuzzy.js";

describe("isSubsequence", () => {
  it("matches dropped letters", () => {
    expect(isSubsequence("daftpnk", "daftpunk")).toBe(true);
    expect(isSubsequence("abc", "aXbXc")).toBe(true);
  });
  it("rejects reordered or extra letters", () => {
    expect(isSubsequence("cba", "abc")).toBe(false);
    expect(isSubsequence("abcd", "abc")).toBe(false);
  });
});

describe("editDistance", () => {
  it("counts single edits", () => {
    expect(editDistance("kitten", "sitten")).toBe(1);
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("", "abc")).toBe(3);
  });
});

describe("scoreMatch", () => {
  it("ranks exact > prefix > substring > subsequence", () => {
    expect(scoreMatch("beyonce", "Beyoncé")).toBe(100); // accent-insensitive exact
    expect(scoreMatch("beyon", "Beyoncé")).toBe(80); // prefix
    expect(scoreMatch("once", "Beyoncé")).toBe(60); // substring
    expect(scoreMatch("dftpnk", "Daft Punk")).toBe(40); // subsequence
  });
  it("tolerates a small typo", () => {
    expect(scoreMatch("radiohed", "Radiohead")).toBeGreaterThan(0);
  });
  it("returns 0 for no match", () => {
    expect(scoreMatch("zzzzzz", "Beyoncé")).toBe(0);
    expect(scoreMatch("", "Beyoncé")).toBe(0);
  });
});

describe("rankSuggestions", () => {
  const list = ["Beyoncé", "Beyoncé (Destiny's Child)", "Bee Gees", "Beck"];
  it("returns best-first and respects the limit", () => {
    const out = rankSuggestions("beyon", list, 2);
    expect(out[0]).toBe("Beyoncé");
    expect(out.length).toBe(2);
  });
  it("empty query returns nothing", () => {
    expect(rankSuggestions("", list)).toEqual([]);
  });
  it("finds a target through dropped letters", () => {
    expect(rankSuggestions("daft pnk", ["Daft Punk", "Deftones"])).toContain(
      "Daft Punk",
    );
  });
});
