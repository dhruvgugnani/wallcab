import { z } from "zod";
import {
  devicePresets,
  learningCategories,
  visualThemes,
} from "@/features/wallpaper/types";

export const wallpaperQuerySchema = z.object({
  category: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.enum(learningCategories))
    .default("vocabulary"),
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
});
