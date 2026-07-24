import { describe, expect, it } from "vitest";
import {
  hmacHex,
  safeEqualHex,
  sha256Hex,
  signPublicCacheKey,
  signServiceRequest,
} from "@/server/cache/signing";

describe("cache signatures", () => {
  it("produces deterministic public and service signatures", () => {
    expect(signPublicCacheKey("wallpaper/key", 123, "secret")).toBe(
      signPublicCacheKey("wallpaper/key", 123, "secret"),
    );
    expect(
      signServiceRequest("PUT", "/v1/cache/key", 123, "abc", "secret"),
    ).not.toBe(
      signServiceRequest("GET", "/v1/cache/key", 123, "abc", "secret"),
    );
  });

  it("compares valid hex without leaking length mismatches", () => {
    const digest = sha256Hex("wallcab");
    expect(safeEqualHex(digest, digest)).toBe(true);
    expect(safeEqualHex(digest, hmacHex("wallcab", "other"))).toBe(false);
    expect(safeEqualHex("not-hex", "not-hex")).toBe(false);
  });
});
