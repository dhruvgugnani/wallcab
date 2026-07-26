import { describe, expect, it } from "vitest";
import {
  deviceDimensions,
  devicePresets,
  learningCategories,
  originalThemes,
  photographicThemes,
  visualThemes,
} from "@/features/wallpaper/types";
import { wallpaperCacheKey } from "@/server/wallpaper-renderer";

describe("daily wallpaper matrix", () => {
  it("creates one distinct cache key for every category, theme, and size", () => {
    const keys = new Set<string>();
    for (const category of learningCategories) {
      for (const theme of visualThemes) {
        for (const size of devicePresets) {
          keys.add(
            wallpaperCacheKey(
              { category, theme, size },
              "2026-07-25",
            ),
          );
        }
      }
    }

    expect(keys.size).toBe(8 * 11 * 3);
    expect([...keys][0]).toContain("/v10/");
    expect(photographicThemes).toHaveLength(5);
    expect(originalThemes).toHaveLength(6);
  });

  it("keeps the exact dimensions for every device preset", () => {
    expect(deviceDimensions.standard).toMatchObject({
      width: 1206,
      height: 2622,
    });
    expect(deviceDimensions.air).toMatchObject({
      width: 1260,
      height: 2736,
    });
    expect(deviceDimensions.max).toMatchObject({
      width: 1320,
      height: 2868,
    });
  });

  it("isolates custom-background cache entries from built-in themes", () => {
    const customId = "A".repeat(22);
    const key = wallpaperCacheKey(
      {
        category: "science",
        theme: "grid",
        size: "standard",
        customBackgroundId: customId,
      },
      "2026-07-25",
    );

    expect(key).toContain(`/custom/${customId}/`);
    expect(key).not.toBe(
      wallpaperCacheKey(
        { category: "science", theme: "grid", size: "standard" },
        "2026-07-25",
      ),
    );
  });
});
