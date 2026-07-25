import {
  CUSTOM_BACKGROUND_DELETE_TOKEN_PATTERN,
  CUSTOM_BACKGROUND_ID_PATTERN,
} from "@/features/wallpaper/custom-background";
import { deleteCustomBackground } from "@/server/cache/client";
import { sha256Hex } from "@/server/cache/signing";
import { checkRateLimit } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 15;

function clientIp(request: Request): string {
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "anonymous"
  );
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const rateLimit = checkRateLimit(
    `custom-delete:${clientIp(request)}`,
    Date.now(),
    10,
    60 * 60 * 1_000,
  );
  if (!rateLimit.allowed) {
    return Response.json(
      {
        code: "CUSTOM_DELETE_RATE_LIMITED",
        message: "Too many deletion attempts. Try again later.",
      },
      { status: 429 },
    );
  }

  const { id } = await context.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const deleteToken =
    body &&
    typeof body === "object" &&
    "deleteToken" in body &&
    typeof body.deleteToken === "string"
      ? body.deleteToken
      : "";

  if (
    !CUSTOM_BACKGROUND_ID_PATTERN.test(id) ||
    !CUSTOM_BACKGROUND_DELETE_TOKEN_PATTERN.test(deleteToken)
  ) {
    return Response.json(
      {
        code: "CUSTOM_BACKGROUND_NOT_FOUND",
        message: "The deletion link is invalid or has expired.",
      },
      { status: 404 },
    );
  }

  const deleted = await deleteCustomBackground(
    id,
    sha256Hex(deleteToken),
  );
  if (!deleted) {
    return Response.json(
      {
        code: "CUSTOM_BACKGROUND_NOT_FOUND",
        message: "The upload was not found or the deletion link is invalid.",
      },
      { status: 404 },
    );
  }

  console.info(
    JSON.stringify({
      event: "wallcab.custom_background",
      action: "deleted",
    }),
  );
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
