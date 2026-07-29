export const SITE_URL = "https://wallcab.dhruvdev.me";
export const GITHUB_URL = "https://github.com/dhruvgugnani/wallcab";
export const DEFAULT_SHORTCUT_URL =
  "https://www.icloud.com/shortcuts/b5728a902dd249fcbaed472311f6da37";

export function getShortcutUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SHORTCUT_URL?.trim() || DEFAULT_SHORTCUT_URL
  );
}

export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}
