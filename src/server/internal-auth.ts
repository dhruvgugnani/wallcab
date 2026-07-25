import {
  safeEqualHex,
  sha256Hex,
} from "@/server/cache/signing";

export function isInternalAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) {
    return false;
  }

  return safeEqualHex(
    sha256Hex(authorization.slice("Bearer ".length)),
    sha256Hex(secret),
  );
}
