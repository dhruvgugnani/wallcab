import { describe, expect, it } from "vitest";
import { parseSupportUrl } from "@/server/support";

describe("support URL configuration", () => {
  it("accepts published Razorpay Payment Page URLs", () => {
    expect(parseSupportUrl("https://rzp.io/l/wallcab-support")).toBe(
      "https://rzp.io/l/wallcab-support",
    );
    expect(
      parseSupportUrl(
        "https://pages.razorpay.com/pl_CjbpJ6gnwk6Ehy/view",
      ),
    ).toBe(
      "https://pages.razorpay.com/pl_CjbpJ6gnwk6Ehy/view",
    );
  });

  it("removes fragments from a supported page", () => {
    expect(parseSupportUrl("https://rzp.io/l/wallcab#payment")).toBe(
      "https://rzp.io/l/wallcab",
    );
  });

  it("rejects missing, insecure, credentialed, prefilled, and unknown URLs", () => {
    expect(parseSupportUrl(undefined)).toBeNull();
    expect(parseSupportUrl("http://rzp.io/l/wallcab")).toBeNull();
    expect(
      parseSupportUrl("https://name:secret@rzp.io/l/wallcab"),
    ).toBeNull();
    expect(
      parseSupportUrl("https://rzp.io/l/wallcab?email=person@example.com"),
    ).toBeNull();
    expect(parseSupportUrl("https://example.com/wallcab")).toBeNull();
    expect(parseSupportUrl("https://rzp.io")).toBeNull();
    expect(parseSupportUrl("https://rzp.io/not-a-page")).toBeNull();
    expect(parseSupportUrl("not a url")).toBeNull();
  });
});
