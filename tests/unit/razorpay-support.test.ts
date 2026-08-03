import { describe, expect, it, vi } from "vitest";
import {
  buildSupportThankYouEmail,
  getSupportEmailConfig,
  parseSupportWebhookPayload,
  sendSupportThankYouEmail,
  verifyRazorpayWebhookSignature,
  type CapturedSupportPayment,
  type SupportEmailConfig,
} from "@/server/razorpay-support";
import { hmacHex } from "@/server/cache/signing";

const secret = "razorpay-webhook-secret-with-32-chars";
const accountId = "acc_WallCab123456";
const payment: CapturedSupportPayment = {
  id: "pay_WallCab123456",
  amount: 25_000,
  currency: "INR",
  email: "supporter@example.com",
};
const config: SupportEmailConfig = {
  razorpayAccountId: accountId,
  razorpayWebhookSecret: secret,
  resendApiKey: "re_test_wallcab_123456789",
  from: "WallCab <thanks@wallcab.dhruvdev.me>",
};

function capturedBody(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    entity: "event",
    account_id: accountId,
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          ...payment,
          status: "captured",
          captured: true,
          international: false,
          ...overrides,
        },
      },
    },
  });
}

describe("Razorpay support webhook", () => {
  it("requires a complete server-only configuration", () => {
    expect(
      getSupportEmailConfig({
        RAZORPAY_ACCOUNT_ID: accountId,
        RAZORPAY_WEBHOOK_SECRET: secret,
        RESEND_API_KEY: config.resendApiKey,
        SUPPORT_EMAIL_FROM: config.from,
      }),
    ).toEqual(config);
    expect(getSupportEmailConfig({})).toBeNull();
    expect(
      getSupportEmailConfig({
        RAZORPAY_ACCOUNT_ID: accountId,
        RAZORPAY_WEBHOOK_SECRET: "short",
        RESEND_API_KEY: config.resendApiKey,
        SUPPORT_EMAIL_FROM: config.from,
      }),
    ).toBeNull();
  });

  it("verifies the HMAC against the untouched request body", () => {
    const body = capturedBody();
    const signature = hmacHex(body, secret);

    expect(
      verifyRazorpayWebhookSignature(body, signature, secret),
    ).toBe(true);
    expect(
      verifyRazorpayWebhookSignature(`${body} `, signature, secret),
    ).toBe(false);
    expect(verifyRazorpayWebhookSignature(body, "not-hex", secret)).toBe(
      false,
    );
  });

  it("accepts only captured domestic INR payments for the expected account", () => {
    expect(parseSupportWebhookPayload(capturedBody(), accountId)).toEqual({
      kind: "captured",
      payment,
    });
    expect(
      parseSupportWebhookPayload(capturedBody(), "acc_Different12345"),
    ).toEqual({ kind: "ignored" });
    expect(
      parseSupportWebhookPayload(
        JSON.stringify({ event: "payment.failed" }),
        accountId,
      ),
    ).toEqual({ kind: "ignored" });
    expect(
      parseSupportWebhookPayload(
        capturedBody({ international: true }),
        accountId,
      ),
    ).toEqual({ kind: "invalid" });
    expect(
      parseSupportWebhookPayload(capturedBody({ currency: "USD" }), accountId),
    ).toEqual({ kind: "invalid" });
    expect(
      parseSupportWebhookPayload(
        capturedBody({ email: "not-an-email" }),
        accountId,
      ),
    ).toEqual({ kind: "invalid" });
  });

  it("builds a branded message without echoing the supporter address", () => {
    const email = buildSupportThankYouEmail(payment);

    expect(email.subject).toBe("Thank you for supporting WallCab");
    expect(email.text).toContain("₹250");
    expect(email.html).toContain("tomorrow&rsquo;s lesson");
    expect(email.html).not.toContain(payment.email);
    expect(email.text).not.toContain(payment.email);
  });

  it("queues one idempotent Resend message", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ id: "email_123" }),
    );

    await expect(
      sendSupportThankYouEmail(payment, config, fetcher),
    ).resolves.toBe(true);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      `Bearer ${config.resendApiKey}`,
    );
    expect(new Headers(init?.headers).get("idempotency-key")).toBe(
      `wallcab-support/${payment.id}`,
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: config.from,
      to: [payment.email],
      subject: "Thank you for supporting WallCab",
    });
  });

  it("asks Razorpay to retry when Resend is unavailable", async () => {
    const rejected = vi.fn<typeof fetch>().mockRejectedValue(
      new Error("provider unavailable"),
    );
    const failed = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, { status: 503 }),
    );

    await expect(
      sendSupportThankYouEmail(payment, config, rejected),
    ).resolves.toBe(false);
    await expect(
      sendSupportThankYouEmail(payment, config, failed),
    ).resolves.toBe(false);
  });
});
