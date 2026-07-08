import { describe, it, expect } from "vitest";
import {
  parsePlaylistId,
  sanitizeFilename,
  trackFilename,
} from "./wav-download.js";

describe("parsePlaylistId", () => {
  it("extracts the id from a full playlist URL", () => {
    expect(
      parsePlaylistId(
        "https://suno.com/playlist/2b2f6c3a-1234-4a5b-9c8d-1234567890ab",
      ),
    ).toBe("2b2f6c3a-1234-4a5b-9c8d-1234567890ab");
  });

  it("accepts a bare id", () => {
    expect(parsePlaylistId("2b2f6c3a-1234-4a5b-9c8d-1234567890ab")).toBe(
      "2b2f6c3a-1234-4a5b-9c8d-1234567890ab",
    );
  });

  it("handles a trailing slash", () => {
    expect(
      parsePlaylistId(
        "https://suno.com/playlist/2b2f6c3a-1234-4a5b-9c8d-1234567890ab/",
      ),
    ).toBe("2b2f6c3a-1234-4a5b-9c8d-1234567890ab");
  });

  it("handles a trailing query string", () => {
    expect(
      parsePlaylistId(
        "https://suno.com/playlist/2b2f6c3a-1234-4a5b-9c8d-1234567890ab?sh=abc123",
      ),
    ).toBe("2b2f6c3a-1234-4a5b-9c8d-1234567890ab");
  });

  it("lowercases a mixed-case id", () => {
    expect(parsePlaylistId("2B2F6C3A-1234-4A5B-9C8D-1234567890AB")).toBe(
      "2b2f6c3a-1234-4a5b-9c8d-1234567890ab",
    );
  });

  it("returns null for bad input", () => {
    expect(parsePlaylistId("not a url")).toBeNull();
    expect(parsePlaylistId("")).toBeNull();
    expect(parsePlaylistId("   ")).toBeNull();
    expect(parsePlaylistId(null)).toBeNull();
    expect(parsePlaylistId(undefined)).toBeNull();
    expect(parsePlaylistId("https://suno.com/playlist/")).toBeNull();
  });
});

describe("sanitizeFilename", () => {
  it("strips forbidden filesystem characters", () => {
    expect(sanitizeFilename('Rock/Pop: "Best" <Mix>|*?')).toBe(
      "Rock Pop Best Mix",
    );
  });

  it("strips backslashes", () => {
    expect(sanitizeFilename("A\\B")).toBe("A B");
  });

  it("collapses internal whitespace", () => {
    expect(sanitizeFilename("Too   Many    Spaces")).toBe("Too Many Spaces");
  });

  it("trims leading/trailing whitespace and dots", () => {
    expect(sanitizeFilename("  ..Song Title..  ")).toBe("Song Title");
  });

  it("falls back when the cleaned result is empty", () => {
    expect(sanitizeFilename("", "Untitled")).toBe("Untitled");
    expect(sanitizeFilename("   ", "Untitled")).toBe("Untitled");
    expect(sanitizeFilename(":::///???", "Untitled")).toBe("Untitled");
    expect(sanitizeFilename(null, "Untitled")).toBe("Untitled");
  });

  it("uses a default fallback when none is given", () => {
    expect(sanitizeFilename("")).toBe("untitled");
  });
});

describe("trackFilename", () => {
  it("zero-pads to width 2 for single-digit totals", () => {
    expect(trackFilename(1, 9, "First Title")).toBe("01 - First Title.wav");
    expect(trackFilename(9, 9, "Last Title")).toBe("09 - Last Title.wav");
  });

  it("zero-pads to width 2 for totals of exactly 10", () => {
    expect(trackFilename(1, 10, "First")).toBe("01 - First.wav");
    expect(trackFilename(10, 10, "Tenth")).toBe("10 - Tenth.wav");
  });

  it("zero-pads to width 3 for totals of 100", () => {
    expect(trackFilename(1, 100, "First")).toBe("001 - First.wav");
    expect(trackFilename(100, 100, "Last")).toBe("100 - Last.wav");
  });

  it("sanitizes the title", () => {
    expect(trackFilename(1, 9, "Rock/Pop: Anthem")).toBe(
      "01 - Rock Pop Anthem.wav",
    );
  });

  it("falls back to a generic title when title is empty", () => {
    expect(trackFilename(3, 9, "")).toBe("03 - Track 03.wav");
  });
});
