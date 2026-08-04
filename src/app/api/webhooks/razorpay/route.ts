import {
  getSupportEmailConfig,
  MAX_RAZORPAY_WEBHOOK_BYTES,
  parseSupportWebhookPayload,
  sendSupportThankYouEmail,
  verifyRazorpayWebhookSignature,
} from "@/server/razorpay-support";

export const runtime = "nodejs";
export const maxDuration = 10;

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function errorResponse(
  status: number,
  code: string,
  message: string,
): Response {
  return Response.json(
    { code, message, requestId: crypto.randomUUID() },
    { status, headers: responseHeaders },
  );
}

async function readBoundedBody(request: Request): Promise<string | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RAZORPAY_WEBHOOK_BYTES
  ) {
    return null;
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return "";
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    byteLength += value.byteLength;
    if (byteLength > MAX_RAZORPAY_WEBHOOK_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const config = getSupportEmailConfig();
  if (!config) {
    return errorResponse(
      503,
      "SUPPORT_EMAIL_NOT_CONFIGURED",
      "Support email is temporarily unavailable.",
    );
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "A JSON webhook payload is required.",
    );
  }

  const rawBody = await readBoundedBody(request);
  if (rawBody === null) {
    return errorResponse(
      413,
      "WEBHOOK_TOO_LARGE",
      "The webhook payload is too large.",
    );
  }

  if (
    !verifyRazorpayWebhookSignature(
      rawBody,
      request.headers.get("x-razorpay-signature"),
      config.razorpayWebhookSecret,
    )
  ) {
    return errorResponse(
      401,
      "INVALID_WEBHOOK_SIGNATURE",
      "The webhook signature is invalid.",
    );
  }

  const payload = parseSupportWebhookPayload(rawBody);
  if (payload.kind === "ignored") {
    return new Response(null, { status: 204, headers: responseHeaders });
  }
  if (payload.kind === "invalid") {
    return errorResponse(
      400,
      "INVALID_WEBHOOK_PAYLOAD",
      "The webhook payload is invalid.",
    );
  }

  const sent = await sendSupportThankYouEmail(payload.payment, config);
  if (!sent) {
    return errorResponse(
      503,
      "SUPPORT_EMAIL_DELIVERY_DEFERRED",
      "The thank-you email could not be queued yet.",
    );
  }

  return new Response(null, { status: 204, headers: responseHeaders });
}
