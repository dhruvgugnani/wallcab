import { describe, expect, it } from "vitest";
import { parseSupportUrl } from "@/server/support";

describe("support URL configuration", () => {
  it("accepts supported HTTPS profile URLs", () => {
    expect(
      parseSupportUrl("https://buymeacoffee.com/wallcab"),
    ).toBe("https://buymeacoffee.com/wallcab");
    expect(parseSupportUrl("https://ko-fi.com/wallcab")).toBe(
      "https://ko-fi.com/wallcab",
    );
  });

  it("removes fragments and preserves safe query values", () => {
    expect(
      parseSupportUrl(
        "https://buymeacoffee.com/wallcab?ref=site#payment",
      ),
    ).toBe("https://buymeacoffee.com/wallcab?ref=site");
  });

  it("rejects missing, insecure, credentialed, and unknown URLs", () => {
    expect(parseSupportUrl(undefined)).toBeNull();
    expect(parseSupportUrl("http://buymeacoffee.com/wallcab")).toBeNull();
    expect(
      parseSupportUrl("https://name:secret@ko-fi.com/wallcab"),
    ).toBeNull();
    expect(parseSupportUrl("https://example.com/wallcab")).toBeNull();
    expect(parseSupportUrl("https://ko-fi.com")).toBeNull();
    expect(parseSupportUrl("not a url")).toBeNull();
  });
});
