import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hmacHex } from "@/server/cache/signing";
import { MAX_RAZORPAY_WEBHOOK_BYTES } from "@/server/razorpay-support";

const emailMocks = vi.hoisted(() => ({
  sendSupportThankYouEmail: vi.fn(),
}));

vi.mock("@/server/razorpay-support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/razorpay-support")>()),
  sendSupportThankYouEmail: emailMocks.sendSupportThankYouEmail,
}));

const environment = {
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  SUPPORT_EMAIL_FROM: process.env.SUPPORT_EMAIL_FROM,
};
const accountId = "acc_WallCab123456";
const secret = "razorpay-webhook-secret-with-32-chars";

function body(event = "payment.captured"): string {
  return JSON.stringify({
    entity: "event",
    account_id: accountId,
    event,
    payload: {
      payment: {
        entity: {
          id: "pay_WallCab123456",
          amount: 5_000,
          currency: "INR",
          status: "captured",
          captured: true,
          international: false,
          email: "supporter@example.com",
          contact: "+919999999999",
        },
      },
    },
  });
}

function request(rawBody: string, signature = hmacHex(rawBody, secret)) {
  return new Request("http://localhost/api/webhooks/razorpay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-razorpay-signature": signature,
    },
    body: rawBody,
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  process.env.RESEND_API_KEY = "re_test_wallcab_123456789";
  process.env.SUPPORT_EMAIL_FROM =
    "WallCab <thanks@wallcab.dhruvdev.me>";
  emailMocks.sendSupportThankYouEmail.mockResolvedValue(true);
});

afterEach(() => {
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

async function route() {
  return import("@/app/api/webhooks/razorpay/route");
}

describe("Razorpay support webhook route", () => {
  it("queues a thank-you for a valid captured payment", async () => {
    const { POST } = await route();
    const response = await POST(request(body()));

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(emailMocks.sendSupportThankYouEmail).toHaveBeenCalledWith(
      {
        id: "pay_WallCab123456",
        amount: 5_000,
        currency: "INR",
        email: "supporter@example.com",
      },
      expect.objectContaining({ razorpayWebhookSecret: secret }),
    );
  });

  it("rejects an invalid signature without parsing or sending", async () => {
    const { POST } = await route();
    const response = await POST(request(body(), "0".repeat(64)));
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(payload.code).toBe("INVALID_WEBHOOK_SIGNATURE");
    expect(emailMocks.sendSupportThankYouEmail).not.toHaveBeenCalled();
  });

  it("acknowledges unrelated events without sending", async () => {
    const { POST } = await route();
    const response = await POST(request(body("payment.failed")));

    expect(response.status).toBe(204);
    expect(emailMocks.sendSupportThankYouEmail).not.toHaveBeenCalled();
  });

  it("rejects a signed malformed captured payload", async () => {
    const rawBody = JSON.stringify({
      account_id: accountId,
      event: "payment.captured",
      payload: {},
    });
    const { POST } = await route();
    const response = await POST(request(rawBody));
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(400);
    expect(payload.code).toBe("INVALID_WEBHOOK_PAYLOAD");
    expect(emailMocks.sendSupportThankYouEmail).not.toHaveBeenCalled();
  });

  it("returns a retryable response when email delivery cannot be queued", async () => {
    emailMocks.sendSupportThankYouEmail.mockResolvedValue(false);
    const { POST } = await route();
    const response = await POST(request(body()));
    const payload = (await response.json()) as { code: string };

    expect(response.status).toBe(503);
    expect(payload.code).toBe("SUPPORT_EMAIL_DELIVERY_DEFERRED");
  });

  it("fails closed when the private configuration is incomplete", async () => {
    delete process.env.RESEND_API_KEY;
    const { POST } = await route();
    const response = await POST(request(body()));

    expect(response.status).toBe(503);
    expect(emailMocks.sendSupportThankYouEmail).not.toHaveBeenCalled();
  });

  it("rejects oversized bodies before email processing", async () => {
    const rawBody = "x".repeat(MAX_RAZORPAY_WEBHOOK_BYTES + 1);
    const { POST } = await route();
    const response = await POST(request(rawBody));

    expect(response.status).toBe(413);
    expect(emailMocks.sendSupportThankYouEmail).not.toHaveBeenCalled();
  });
});
