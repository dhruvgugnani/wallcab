import { z } from "zod";
import { CUSTOM_UPLOAD_TURNSTILE_ACTION } from "@/features/wallpaper/custom-background";

const TURNSTILE_TOKEN_MAX_LENGTH = 2_048;

const siteverifySchema = z.object({
  success: z.boolean(),
  action: z.string().optional(),
  hostname: z.string().optional(),
  "error-codes": z.array(z.string()).optional(),
});

function expectedHostnames(): Set<string> {
  return new Set(
    (process.env.TURNSTILE_HOSTNAMES ?? "")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function hasTurnstileConfiguration(): boolean {
  return Boolean(
    process.env.TURNSTILE_SECRET && expectedHostnames().size > 0,
  );
}

export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET;
  const hostnames = expectedHostnames();

  if (
    !secret ||
    hostnames.size === 0 ||
    token.length === 0 ||
    token.length > TURNSTILE_TOKEN_MAX_LENGTH
  ) {
    return false;
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          secret,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
          idempotency_key: crypto.randomUUID(),
        }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );
    if (!response.ok) {
      return false;
    }

    const result = siteverifySchema.parse(await response.json());
    return Boolean(
      result.success &&
        result.action === CUSTOM_UPLOAD_TURNSTILE_ACTION &&
        result.hostname &&
        hostnames.has(result.hostname.toLowerCase()),
    );
  } catch {
    return false;
  }
}
