export const learningCategories = [
  "vocabulary",
  "coding",
  "finance",
  "stoicism",
  "science",
  "history",
  "psychology",
  "productivity",
] as const;

export const photographicThemes = [
  "nature",
  "mountains",
  "ocean",
  "forest",
  "space",
] as const;

export const originalThemes = [
  "amoled",
  "minimal",
  "abstract",
  "gradient",
  "monochrome",
  "grid",
] as const;

export const visualThemes = [
  ...photographicThemes,
  ...originalThemes,
] as const;

export const devicePresets = ["standard", "air", "max"] as const;

export type LearningCategory = (typeof learningCategories)[number];
export type PhotographicTheme = (typeof photographicThemes)[number];
export type OriginalTheme = (typeof originalThemes)[number];
export type VisualTheme = (typeof visualThemes)[number];
export type DevicePreset = (typeof devicePresets)[number];

export type SourceAttribution = {
  label: string;
  url: string;
  license: string;
  creator?: string;
};

export type ContentProvenance = {
  mode: "external" | "fallback";
  provider: string;
  fallbackReason?:
    | "provider_unavailable"
    | "provider_timeout"
    | "invalid_response"
    | "unusable_content";
};

export type DailyLesson = {
  date: string;
  category: LearningCategory;
  term: string;
  definition: string;
  quote: {
    text: string;
    author: string;
  };
  fact: string;
  sources: SourceAttribution[];
  provenance: ContentProvenance;
};

export type BackgroundAttribution = SourceAttribution & {
  source: string;
};

export type BackgroundAsset = {
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/svg+xml" | "image/webp";
  attribution: BackgroundAttribution;
};

export type WallpaperPreferences = {
  categories: LearningCategory[];
  theme: VisualTheme;
  size: DevicePreset;
  customBackgroundId?: string;
};

export type ResolvedWallpaperRequest = {
  category: LearningCategory;
  theme: VisualTheme;
  size: DevicePreset;
  customBackgroundId?: string;
};

export type WallpaperCacheRecord = ResolvedWallpaperRequest & {
  key: string;
  date: string;
  etag: string;
  byteLength: number;
};

export type WallpaperOutput = WallpaperCacheRecord & {
  bytes: Uint8Array;
  lesson: DailyLesson;
  background: BackgroundAttribution;
};

export const deviceDimensions: Record<
  DevicePreset,
  { width: number; height: number; label: string }
> = {
  standard: {
    width: 1206,
    height: 2622,
    label: "iPhone 17 / 17 Pro",
  },
  air: {
    width: 1260,
    height: 2736,
    label: "iPhone Air",
  },
  max: {
    width: 1320,
    height: 2868,
    label: "iPhone 17 Pro Max",
  },
};

export const categoryLabels: Record<LearningCategory, string> = {
  vocabulary: "Vocabulary",
  coding: "Coding",
  finance: "Finance",
  stoicism: "Stoicism",
  science: "Science",
  history: "History",
  psychology: "Psychology",
  productivity: "Productivity",
};

export const themeLabels: Record<VisualTheme, string> = {
  nature: "Nature",
  mountains: "Mountains",
  ocean: "Ocean",
  forest: "Forest",
  space: "Space",
  amoled: "AMOLED",
  minimal: "Minimal",
  abstract: "Abstract",
  gradient: "Gradient",
  monochrome: "Black & White",
  grid: "Grid",
};

export const themeCadence: Record<VisualTheme, "daily" | "fixed"> = {
  nature: "daily",
  mountains: "daily",
  ocean: "daily",
  forest: "daily",
  space: "daily",
  amoled: "fixed",
  minimal: "fixed",
  abstract: "fixed",
  gradient: "fixed",
  monochrome: "fixed",
  grid: "fixed",
};

export function isLearningCategory(value: string): value is LearningCategory {
  return learningCategories.includes(value as LearningCategory);
}

export function isVisualTheme(value: string): value is VisualTheme {
  return visualThemes.includes(value as VisualTheme);
}

export function isPhotographicTheme(
  value: VisualTheme,
): value is PhotographicTheme {
  return photographicThemes.includes(value as PhotographicTheme);
}

export function isOriginalTheme(value: VisualTheme): value is OriginalTheme {
  return originalThemes.includes(value as OriginalTheme);
}

export function isDevicePreset(value: string): value is DevicePreset {
  return devicePresets.includes(value as DevicePreset);
}
