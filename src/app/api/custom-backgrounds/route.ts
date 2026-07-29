import { storeCustomBackground } from "@/server/custom-backgrounds";
import { SITE_URL } from "@/lib/site-config";
import {
  hasTurnstileConfiguration,
  verifyTurnstileToken,
} from "@/server/turnstile";
import { checkRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_REQUEST_BYTES = Math.floor(4.4 * 1024 * 1024);
const allowedUploadTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function clientIp(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
}

function errorResponse(
  code: string,
  message: string,
  status: number,
): Response {
  return Response.json(
    { code, message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  const requestLength = Number(request.headers.get("content-length") ?? 0);
  if (requestLength > MAX_REQUEST_BYTES) {
    return errorResponse(
      "CUSTOM_BACKGROUND_TOO_LARGE",
      "Choose an image smaller than 4 MB.",
      413,
    );
  }

  const rateLimit = checkRateLimit(
    `custom-upload:${clientIp(request)}`,
    Date.now(),
    5,
    60 * 60 * 1_000,
  );
  if (!rateLimit.allowed) {
    return errorResponse(
      "CUSTOM_UPLOAD_RATE_LIMITED",
      "Too many uploads. Try again later.",
      429,
    );
  }

  if (!hasTurnstileConfiguration()) {
    return errorResponse(
      "CUSTOM_UPLOAD_NOT_CONFIGURED",
      "Custom uploads are not configured yet.",
      503,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(
      "INVALID_CUSTOM_UPLOAD",
      "The upload form could not be read.",
      400,
    );
  }

  const token = form.get("turnstileToken");
  const image = form.get("image");
  const rightsConfirmed = form.get("rightsConfirmed");
  if (
    typeof token !== "string" ||
    rightsConfirmed !== "true" ||
    !(image instanceof File) ||
    !allowedUploadTypes.has(image.type) ||
    image.size === 0 ||
    image.size > 4 * 1024 * 1024
  ) {
    return errorResponse(
      "INVALID_CUSTOM_UPLOAD",
      "Confirm your image rights and choose a JPEG, PNG, or WebP smaller than 4 MB.",
      400,
    );
  }

  if (!(await verifyTurnstileToken(token, clientIp(request)))) {
    return errorResponse(
      "TURNSTILE_REJECTED",
      "Verification expired or failed. Please try again.",
      403,
    );
  }

  try {
    const stored = await storeCustomBackground(
      new Uint8Array(await image.arrayBuffer()),
    );
    if (!stored) {
      return errorResponse(
        "CUSTOM_STORAGE_UNAVAILABLE",
        "Custom background storage is temporarily unavailable.",
        503,
      );
    }

    const deletionUrl = `${SITE_URL}/custom-background/delete#${stored.id}.${stored.deleteToken}`;

    console.info(
      JSON.stringify({
        event: "wallcab.custom_background",
        action: "stored",
        retention: "30-days-inactive",
      }),
    );

    return Response.json(
      {
        backgroundId: stored.id,
        deleteToken: stored.deleteToken,
        deletionUrl,
        inactiveDays: 30,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return errorResponse(
      "INVALID_CUSTOM_BACKGROUND",
      "The image could not be prepared. Try a different JPEG, PNG, or WebP.",
      400,
    );
  }
}
