import { beforeEach, describe, expect, it, vi } from "vitest";
import { SITE_URL } from "@/lib/site-config";

const backgroundMocks = vi.hoisted(() => ({
  storeCustomBackground: vi.fn(),
}));
const turnstileMocks = vi.hoisted(() => ({
  hasTurnstileConfiguration: vi.fn(),
  verifyTurnstileToken: vi.fn(),
}));
const cacheMocks = vi.hoisted(() => ({
  deleteCustomBackground: vi.fn(),
}));
const rateMocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
}));

vi.mock("@/server/custom-backgrounds", () => backgroundMocks);
vi.mock("@/server/turnstile", () => turnstileMocks);
vi.mock("@/server/cache/client", () => cacheMocks);
vi.mock("@/server/rate-limit", () => rateMocks);

const id = "A".repeat(22);
const deleteToken = "B".repeat(43);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  rateMocks.checkRateLimit.mockReturnValue({
    allowed: true,
    limit: 5,
    remaining: 4,
    resetAt: 1,
  });
  turnstileMocks.hasTurnstileConfiguration.mockReturnValue(true);
  turnstileMocks.verifyTurnstileToken.mockResolvedValue(true);
  backgroundMocks.storeCustomBackground.mockResolvedValue({
    id,
    deleteToken,
  });
  cacheMocks.deleteCustomBackground.mockResolvedValue(true);
});

async function uploadRoute() {
  return import("@/app/api/custom-backgrounds/route");
}

async function deleteRoute() {
  return import("@/app/api/custom-backgrounds/[id]/route");
}

function uploadRequest(): Request {
  const form = new FormData();
  form.set(
    "image",
    new File([Uint8Array.from([1, 2, 3])], "background.webp", {
      type: "image/webp",
    }),
  );
  form.set("turnstileToken", "verified-token");
  form.set("rightsConfirmed", "true");
  return new Request("https://wallcab.example/api/custom-backgrounds", {
    method: "POST",
    body: form,
    headers: { "x-real-ip": "192.0.2.40" },
  });
}

describe("custom background routes", () => {
  it("verifies Turnstile before returning private upload credentials", async () => {
    const { POST } = await uploadRoute();
    const response = await POST(uploadRequest());
    const body = (await response.json()) as {
      backgroundId: string;
      deleteToken: string;
      deletionUrl: string;
      inactiveDays: number;
    };

    expect(response.status).toBe(201);
    expect(turnstileMocks.verifyTurnstileToken).toHaveBeenCalledWith(
      "verified-token",
      "192.0.2.40",
    );
    expect(body).toEqual({
      backgroundId: id,
      deleteToken,
      deletionUrl: `${SITE_URL}/custom-background/delete#${id}.${deleteToken}`,
      inactiveDays: 30,
    });
  });

  it("fails closed when Turnstile rejects the upload", async () => {
    turnstileMocks.verifyTurnstileToken.mockResolvedValue(false);
    const { POST } = await uploadRoute();
    const response = await POST(uploadRequest());

    expect(response.status).toBe(403);
    expect(backgroundMocks.storeCustomBackground).not.toHaveBeenCalled();
  });

  it("rejects an upload when Turnstile is not configured", async () => {
    turnstileMocks.hasTurnstileConfiguration.mockReturnValue(false);
    const { POST } = await uploadRoute();
    const response = await POST(uploadRequest());

    expect(response.status).toBe(503);
  });

  it("requires an explicit image-rights declaration", async () => {
    const form = new FormData();
    form.set(
      "image",
      new File([Uint8Array.from([1])], "background.webp", {
        type: "image/webp",
      }),
    );
    form.set("turnstileToken", "verified-token");
    const { POST } = await uploadRoute();
    const response = await POST(
      new Request("https://wallcab.example/api/custom-backgrounds", {
        method: "POST",
        body: form,
      }),
    );

    expect(response.status).toBe(400);
    expect(turnstileMocks.verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it("deletes with the private token without exposing it in the URL", async () => {
    const { DELETE } = await deleteRoute();
    const response = await DELETE(
      new Request(`https://wallcab.example/api/custom-backgrounds/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteToken }),
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(204);
    expect(cacheMocks.deleteCustomBackground).toHaveBeenCalledWith(
      id,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
  });

  it("uses the same not-found response for invalid deletion credentials", async () => {
    const { DELETE } = await deleteRoute();
    const response = await DELETE(
      new Request(
        "https://wallcab.example/api/custom-backgrounds/invalid",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deleteToken: "wrong" }),
        },
      ),
      { params: Promise.resolve({ id: "invalid" }) },
    );

    expect(response.status).toBe(404);
    expect(cacheMocks.deleteCustomBackground).not.toHaveBeenCalled();
  });
});
