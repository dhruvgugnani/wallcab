export const CUSTOM_BACKGROUND_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
export const CUSTOM_BACKGROUND_DELETE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const CUSTOM_UPLOAD_TURNSTILE_ACTION = "custom_background_upload";

export function isCustomBackgroundId(value: unknown): value is string {
  return (
    typeof value === "string" && CUSTOM_BACKGROUND_ID_PATTERN.test(value)
  );
}

export function isCustomBackgroundDeleteToken(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    CUSTOM_BACKGROUND_DELETE_TOKEN_PATTERN.test(value)
  );
}
