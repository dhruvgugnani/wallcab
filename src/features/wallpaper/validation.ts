import { z } from "zod";
import {
  devicePresets,
  learningCategories,
  visualThemes,
  type LearningCategory,
  type WallpaperPreferences,
} from "@/features/wallpaper/types";
import { normalizeLearningCategories } from "@/features/wallpaper/preferences";
import { CUSTOM_BACKGROUND_ID_PATTERN } from "@/features/wallpaper/custom-background";

const categoriesSchema = z
  .string()
  .trim()
  .toLowerCase()
  .default("vocabulary")
  .transform((value, context) => {
    const values = value
      .split(",")
      .map((category) => category.trim())
      .filter(Boolean);
    const invalid = values.filter(
      (category) =>
        !learningCategories.includes(category as LearningCategory),
    );

    if (values.length === 0 || invalid.length > 0) {
      context.addIssue({
        code: "custom",
        message: "Choose between one and eight supported categories.",
      });
      return z.NEVER;
    }

    return normalizeLearningCategories(values as LearningCategory[]);
  })
  .pipe(z.array(z.enum(learningCategories)).min(1).max(8));

export const wallpaperQuerySchema = z.object({
  categories: categoriesSchema,
  theme: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(visualThemes))
    .default("nature"),
  size: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(devicePresets))
    .default("standard"),
  customBackgroundId: z
    .string()
    .trim()
    .regex(CUSTOM_BACKGROUND_ID_PATTERN)
    .optional(),
});

export function parseWallpaperSearchParams(
  searchParams: URLSearchParams,
):
  | { success: true; value: WallpaperPreferences }
  | { success: false; legacyCategory: boolean } {
  const legacyCategory = searchParams.has("category");
  if (legacyCategory) {
    return { success: false, legacyCategory: true };
  }

  const parsed = wallpaperQuerySchema.safeParse({
    categories: searchParams.get("categories") ?? undefined,
    theme: searchParams.get("theme") ?? undefined,
    size: searchParams.get("size") ?? undefined,
    customBackgroundId: searchParams.get("background") ?? undefined,
  });

  return parsed.success
    ? { success: true, value: parsed.data }
    : { success: false, legacyCategory: false };
}
