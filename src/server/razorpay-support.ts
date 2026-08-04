import { hmacHex, safeEqualHex } from "@/server/cache/signing";
import { SITE_URL } from "@/lib/site-config";

export const MAX_RAZORPAY_WEBHOOK_BYTES = 64 * 1024;

const paymentIdPattern = /^pay_[A-Za-z0-9]{8,64}$/;
const accountIdPattern = /^acc_[A-Za-z0-9]{8,64}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const senderPattern = /^[^<>\r\n]{1,64} <[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>$/;

type JsonRecord = Record<string, unknown>;

export interface CapturedSupportPayment {
  id: string;
  amount: number;
  currency: "INR";
  email: string;
}

export interface SupportEmailConfig {
  razorpayWebhookSecret: string;
  resendApiKey: string;
  from: string;
}

export type SupportWebhookPayload =
  | { kind: "captured"; payment: CapturedSupportPayment }
  | { kind: "ignored" }
  | { kind: "invalid" };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    emailPattern.test(value)
  );
}

export function getSupportEmailConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): SupportEmailConfig | null {
  const razorpayWebhookSecret = environment.RAZORPAY_WEBHOOK_SECRET?.trim();
  const resendApiKey = environment.RESEND_API_KEY?.trim();
  const from = environment.SUPPORT_EMAIL_FROM?.trim();

  if (
    !razorpayWebhookSecret ||
    razorpayWebhookSecret.length < 32 ||
    !resendApiKey ||
    resendApiKey.length < 16 ||
    !from ||
    !senderPattern.test(from)
  ) {
    return null;
  }

  return {
    razorpayWebhookSecret,
    resendApiKey,
    from,
  };
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) {
    return false;
  }
  return safeEqualHex(signature, hmacHex(rawBody, secret));
}

export function parseSupportWebhookPayload(
  rawBody: string,
): SupportWebhookPayload {
  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody);
  } catch {
    return { kind: "invalid" };
  }

  if (!isRecord(decoded) || typeof decoded.event !== "string") {
    return { kind: "invalid" };
  }
  if (decoded.event !== "payment.captured") {
    return { kind: "ignored" };
  }
  if (
    typeof decoded.account_id !== "string" ||
    !accountIdPattern.test(decoded.account_id)
  ) {
    return { kind: "invalid" };
  }

  const payload = decoded.payload;
  const paymentContainer = isRecord(payload) ? payload.payment : null;
  const payment = isRecord(paymentContainer)
    ? paymentContainer.entity
    : null;
  if (!isRecord(payment)) {
    return { kind: "invalid" };
  }

  const validPayment =
    typeof payment.id === "string" &&
    paymentIdPattern.test(payment.id) &&
    typeof payment.amount === "number" &&
    Number.isSafeInteger(payment.amount) &&
    payment.amount > 0 &&
    payment.amount <= 100_000_000 &&
    payment.currency === "INR" &&
    payment.status === "captured" &&
    payment.captured === true &&
    payment.international === false &&
    isEmail(payment.email);

  if (!validPayment) {
    return { kind: "invalid" };
  }

  return {
    kind: "captured",
    payment: {
      id: payment.id as string,
      amount: payment.amount as number,
      currency: "INR",
      email: payment.email as string,
    },
  };
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: amount % 100 === 0 ? 0 : 2,
  }).format(amount / 100);
}

export function buildSupportThankYouEmail(
  payment: CapturedSupportPayment,
): { subject: string; text: string; html: string } {
  const amount = formatAmount(payment.amount);
  const reference = payment.id.slice(-8).toUpperCase();
  const subject = "Thank you for supporting WallCab";
  const text = [
    "Thank you for supporting WallCab.",
    "",
    `Your ${amount} contribution helps keep daily learning wallpapers free, source-credited, and available without an account.`,
    "",
    "There is no subscription and nothing else you need to do.",
    `Payment reference: ${reference}`,
    "",
    SITE_URL,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#090a08;color:#eeeadd;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your support helps keep daily learning wallpapers free.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#090a08;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;border:1px solid #30322c;background:#0d0e0b;">
            <tr>
              <td style="padding:42px 38px 24px;color:#a8b89a;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">WallCab / Independent project</td>
            </tr>
            <tr>
              <td style="padding:0 38px;color:#f4f0e3;font-family:Georgia,serif;font-size:44px;line-height:1.02;letter-spacing:-1.5px;">You helped keep tomorrow&rsquo;s lesson moving.</td>
            </tr>
            <tr>
              <td style="padding:28px 38px 10px;color:#c9c6ba;font-size:16px;line-height:1.7;">Your <strong style="color:#f4f0e3;">${amount}</strong> contribution helps keep daily learning wallpapers free, source-credited, and available without an account.</td>
            </tr>
            <tr>
              <td style="padding:0 38px 30px;color:#8f9188;font-size:14px;line-height:1.7;">There is no subscription and nothing else you need to do.</td>
            </tr>
            <tr>
              <td style="padding:0 38px 42px;">
                <a href="${SITE_URL}" style="display:inline-block;border:1px solid #a8b89a;background:#f4f0e3;color:#090a08;padding:13px 18px;font-size:11px;font-weight:700;letter-spacing:1.4px;text-decoration:none;text-transform:uppercase;">Return to WallCab</a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #30322c;padding:20px 38px;color:#74766e;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;">Payment reference ${reference}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendSupportThankYouEmail(
  payment: CapturedSupportPayment,
  config: SupportEmailConfig,
  fetcher: typeof fetch = fetch,
): Promise<boolean> {
  const email = buildSupportThankYouEmail(payment);

  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `wallcab-support/${payment.id}`,
      },
      body: JSON.stringify({
        from: config.from,
        to: [payment.email],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    return response.ok;
  } catch {
    return false;
  }
}
