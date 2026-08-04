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
  name?: string;
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

function normalizeSupporterName(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  const length = Array.from(normalized).length;
  if (length < 2 || length > 60) {
    return undefined;
  }

  return normalized;
}

function getSupporterName(payment: JsonRecord): string | undefined {
  const notes = isRecord(payment.notes) ? payment.notes : null;
  const card = isRecord(payment.card) ? payment.card : null;
  const candidates = [
    notes?.supporter_name,
    notes?.customer_name,
    notes?.name,
    card?.name,
  ];

  for (const candidate of candidates) {
    const name = normalizeSupporterName(candidate);
    if (name) {
      return name;
    }
  }

  return undefined;
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

  const supporterName = getSupporterName(payment);

  return {
    kind: "captured",
    payment: {
      id: payment.id as string,
      amount: payment.amount as number,
      currency: "INR",
      email: payment.email as string,
      ...(supporterName ? { name: supporterName } : {}),
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

export function buildSupportThankYouEmail(
  payment: CapturedSupportPayment,
): { subject: string; text: string; html: string } {
  const amount = formatAmount(payment.amount);
  const reference = payment.id.slice(-8).toUpperCase();
  const supporterName = normalizeSupporterName(payment.name);
  const greeting = supporterName
    ? `Thank you, ${supporterName}.`
    : "Thank you for supporting WallCab.";
  const escapedGreeting = escapeHtml(greeting);
  const subject = "Thank you for supporting WallCab";
  const text = [
    greeting,
    "",
    `Your ${amount} contribution reached WallCab.`,
    "",
    "WallCab began as a small attempt to make the lock screen feel less disposable. Your support helps pay for the sources, infrastructure, and quiet hours behind each daily edition.",
    "",
    "Thank you for believing in a quieter way to learn.",
    "— Dhruv",
    "",
    `Amount: ${amount}`,
    `Payment reference: ${reference}`,
    "There is no subscription and nothing else you need to do.",
    "",
    SITE_URL,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <style>
      @media only screen and (min-width: 641px) {
        .email-pad { padding-left: 34px !important; padding-right: 34px !important; }
        .stack-column { display: table-cell !important; box-sizing: content-box !important; }
        .phone-column { width: 300px !important; padding: 48px 20px 48px 34px !important; }
        .copy-column { width: 380px !important; padding: 48px 40px 48px 24px !important; }
        .receipt-cell { display: table-cell !important; width: 33.33% !important; border-top: 0 !important; }
        .receipt-middle, .receipt-last { border-left: 1px solid #30332d !important; }
        .headline { font-size: 44px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#080907;color:#eeeadd;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">Your contribution reached WallCab. Here is your receipt and a note from Dhruv.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#080907" style="width:100%;background:#080907;">
      <tr>
        <td align="center" style="padding:32px 14px;">
          <table class="email-shell" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#0d0e0b" style="width:100%;max-width:680px;border:1px solid #30332c;background:#0d0e0b;">
            <tr>
              <td class="email-pad" style="padding:24px;border-bottom:1px solid #30332c;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td valign="middle">
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td width="26" height="32" align="center" valign="middle" style="width:26px;height:32px;border:1px solid #f1eddf;color:#f1eddf;font-size:16px;line-height:16px;">≡</td>
                          <td style="padding-left:12px;color:#f1eddf;font-size:11px;font-weight:700;letter-spacing:2.4px;text-transform:uppercase;">WallCab</td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" valign="middle" style="color:#84877d;font-size:9px;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;">Support edition / 01</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="stack-column phone-column" width="100%" align="center" valign="middle" style="display:block;width:100%;max-width:100%;box-sizing:border-box;padding:8px 0 38px;">
                      <table role="presentation" width="218" cellspacing="0" cellpadding="0" border="0" bgcolor="#0b1510" style="width:218px;border:5px solid #3b3e38;border-radius:36px;background-color:#0b1510;background-image:linear-gradient(145deg,#344a3b 0%,#13221a 48%,#080a08 100%);box-shadow:0 22px 46px rgba(0,0,0,.46);">
                        <tr>
                          <td style="padding:15px 17px 0;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td style="color:#f4f0e3;font-size:11px;font-weight:700;">09:41</td>
                                <td align="right" style="color:#b6b8af;font-size:7px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Payment receipt</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" style="padding-top:3px;"><span style="display:inline-block;width:62px;height:16px;border-radius:99px;background:#030403;font-size:0;line-height:0;">&nbsp;</span></td>
                        </tr>
                        <tr>
                          <td height="238" valign="bottom" style="height:238px;padding:0 20px 22px;">
                            <div style="color:#aebf91;font-size:7px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;">WallCab support / confirmed</div>
                            <div style="padding-top:8px;color:#f4f0e3;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1;letter-spacing:-1px;">${amount}</div>
                            <div style="padding-top:9px;color:#f4f0e3;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.15;">Payment received.</div>
                            <div style="padding-top:5px;color:#aeb1a7;font-family:Georgia,'Times New Roman',serif;font-size:9px;font-style:italic;line-height:1.45;">You kept WallCab moving.</div>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:15px;border-top:1px solid rgba(238,234,221,.22);">
                              <tr>
                                <td valign="top" style="padding-top:11px;">
                                  <div style="color:#777d73;font-size:6px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Status</div>
                                  <div style="padding-top:4px;color:#bcd57c;font-size:7px;font-weight:700;letter-spacing:.9px;text-transform:uppercase;">Received</div>
                                </td>
                                <td align="right" valign="top" style="padding-top:11px;">
                                  <div style="color:#777d73;font-size:6px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Reference</div>
                                  <div style="padding-top:4px;color:#d5d2c8;font-size:7px;font-weight:700;letter-spacing:.8px;">${reference}</div>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:14px 20px 18px;border-top:1px solid rgba(238,234,221,.14);">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                              <tr>
                                <td style="color:#f4f0e3;font-size:7px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;">WallCab</td>
                                <td align="right" style="color:#858a80;font-size:6px;letter-spacing:.8px;text-transform:uppercase;">One-time support<br>Thank you</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td class="stack-column copy-column" width="100%" valign="middle" style="display:block;width:100%;max-width:100%;box-sizing:border-box;padding:0 24px 40px;overflow-wrap:break-word;word-break:normal;">
                      <div style="color:#bcd57c;font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">A note from Dhruv</div>
                      <div class="headline" style="max-width:100%;padding-top:15px;color:#f4f0e3;font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:1.04;letter-spacing:-1.2px;overflow-wrap:break-word;word-break:normal;">${escapedGreeting}</div>
                      <div style="padding-top:23px;color:#c9c6ba;font-size:14px;line-height:1.72;">WallCab began as a small attempt to make the lock screen feel less disposable. Your support helps pay for the sources, infrastructure, and quiet hours behind each daily edition.</div>
                      <div style="margin-top:22px;padding-left:16px;border-left:1px solid #a8b89a;color:#9fa198;font-family:Georgia,'Times New Roman',serif;font-size:14px;font-style:italic;line-height:1.6;">Thank you for believing in a quieter way to learn.<br><span style="color:#f4f0e3;font-style:normal;">&mdash; Dhruv</span></div>
                      <div style="padding-top:28px;">
                        <a href="${SITE_URL}" style="display:inline-block;border:1px solid #f4f0e3;background:#f4f0e3;color:#090a08;padding:14px 19px;font-size:10px;font-weight:700;letter-spacing:1.5px;text-decoration:none;text-transform:uppercase;">Open WallCab&nbsp;&nbsp;↗</a>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #30332d;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="receipt-cell" width="100%" style="display:block;width:auto;box-sizing:border-box;padding:19px 24px;">
                      <div style="color:#74786f;font-size:8px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Contribution</div>
                      <div style="padding-top:6px;color:#f4f0e3;font-family:Georgia,'Times New Roman',serif;font-size:21px;">${amount}</div>
                    </td>
                    <td class="receipt-cell receipt-middle" width="100%" style="display:block;width:auto;box-sizing:border-box;padding:19px 24px;border-top:1px solid #30332d;">
                      <div style="color:#74786f;font-size:8px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Reference</div>
                      <div style="padding-top:8px;color:#d2cfc4;font-size:11px;font-weight:700;letter-spacing:1.1px;">${reference}</div>
                    </td>
                    <td class="receipt-cell receipt-last" width="100%" style="display:block;width:auto;box-sizing:border-box;padding:19px 24px;border-top:1px solid #30332d;">
                      <div style="color:#74786f;font-size:8px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;">Status</div>
                      <div style="padding-top:8px;color:#bcd57c;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Received</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:22px 24px;border-top:1px solid #30332d;color:#73766d;font-size:10px;line-height:1.6;overflow-wrap:break-word;word-break:normal;">This is a one-time transactional receipt. There is no subscription and nothing else you need to do. WallCab does not store your supporter profile.</td>
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
