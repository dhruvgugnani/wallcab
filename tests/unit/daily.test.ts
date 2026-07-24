import { describe, expect, it } from "vitest";
import {
  getFallbackLesson,
  hashString,
  toUtcDateKey,
} from "@/features/wallpaper/daily";
import { fallbackSeeds } from "@/features/wallpaper/fallback-content";
import { learningCategories } from "@/features/wallpaper/types";

describe("daily fallback selection", () => {
  it("contains exactly 30 reviewed records per category", () => {
    for (const category of learningCategories) {
      expect(fallbackSeeds[category]).toHaveLength(30);
    }
  });

  it("is deterministic for a category and UTC date", () => {
    const date = new Date("2026-07-25T23:59:00Z");
    expect(getFallbackLesson("science", date)).toEqual(
      getFallbackLesson("science", date),
    );
    expect(toUtcDateKey(date)).toBe("2026-07-25");
  });

  it("returns a stable unsigned hash", () => {
    expect(hashString("wallcab")).toBe(hashString("wallcab"));
    expect(hashString("wallcab")).toBeGreaterThanOrEqual(0);
  });
});
