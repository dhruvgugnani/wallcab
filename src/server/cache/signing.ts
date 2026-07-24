import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export function sha256Hex(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacHex(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function signPublicCacheKey(
  key: string,
  expires: number,
  secret: string,
): string {
  return hmacHex(`${key}\n${expires}`, secret);
}

export function signServiceRequest(
  method: string,
  path: string,
  timestamp: number,
  bodyHash: string,
  secret: string,
): string {
  return hmacHex(
    `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`,
    secret,
  );
}

export function safeEqualHex(left: string, right: string): boolean {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return (
    leftBytes.length === rightBytes.length &&
    timingSafeEqual(leftBytes, rightBytes)
  );
}
