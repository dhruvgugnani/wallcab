export interface Env {
  WALLPAPERS: KVNamespace;
  CACHE_WORKER_SECRET: string;
  CACHE_SIGNING_SECRET: string;
  ALLOWED_ORIGINS?: string;
}

type CacheMetadata = {
  contentType: string;
  etag: string;
  storedAt: string;
};

const MAX_CACHE_BYTES = 5 * 1024 * 1024;
const MAX_AUTH_SKEW_SECONDS = 300;
const PUBLIC_LINK_MAX_SECONDS = 600;
const allowedContentTypes = new Set([
  "application/json",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
]);

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: ArrayBuffer | string): Promise<string> {
  const input =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  return hex(await crypto.subtle.digest("SHA-256", input));
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)),
  );
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function parseKey(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) {
    return null;
  }
  try {
    const key = decodeURIComponent(pathname.slice(prefix.length));
    return key.length > 0 &&
      new TextEncoder().encode(key).byteLength <= 512 &&
      !/[\u0000-\u001f\u007f]/.test(key)
      ? key
      : null;
  } catch {
    return null;
  }
}

function corsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get("origin");
  const allowed = new Set(
    (env.ALLOWED_ORIGINS ??
      "https://wallcab.dhruvdev.me,http://localhost:3000")
      .split(",")
      .map((item) => item.trim()),
  );
  return origin && allowed.has(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        Vary: "Origin",
      }
    : {};
}

function json(
  request: Request,
  env: Env,
  body: unknown,
  status: number,
): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(request, env),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function verifyServiceRequest(
  request: Request,
  env: Env,
  bodyHash: string,
): Promise<boolean> {
  const timestamp = Number(request.headers.get("x-wallcab-timestamp"));
  const signature = request.headers.get("x-wallcab-signature") ?? "";
  const declaredHash = request.headers.get("x-wallcab-body-sha256") ?? "";
  const now = Math.floor(Date.now() / 1_000);

  if (
    !Number.isInteger(timestamp) ||
    Math.abs(now - timestamp) > MAX_AUTH_SKEW_SECONDS ||
    !constantTimeEqual(declaredHash, bodyHash)
  ) {
    return false;
  }

  const canonical = `${request.method.toUpperCase()}\n${new URL(request.url).pathname}\n${timestamp}\n${bodyHash}`;
  const expected = await hmac(canonical, env.CACHE_WORKER_SECRET);
  return constantTimeEqual(signature, expected);
}

async function readCache(
  request: Request,
  env: Env,
  key: string,
  publicAsset: boolean,
): Promise<Response> {
  const cached = await env.WALLPAPERS.getWithMetadata<CacheMetadata>(
    key,
    "arrayBuffer",
  );
  if (
    !cached.value ||
    !cached.metadata ||
    (publicAsset && cached.metadata.contentType !== "image/png")
  ) {
    return json(request, env, { code: "NOT_FOUND" }, 404);
  }

  const headers: HeadersInit = {
    ...corsHeaders(request, env),
    "Cache-Control": publicAsset
      ? "public, max-age=300, immutable"
      : "private, no-store",
    "Content-Length": String(cached.value.byteLength),
    "Content-Type": cached.metadata.contentType,
    ETag: `"${cached.metadata.etag}"`,
    "X-Content-Type-Options": "nosniff",
    "X-WallCab-Cache": "HIT",
  };

  return new Response(
    request.method === "HEAD" ? null : cached.value,
    { status: 200, headers },
  );
}

async function handlePublic(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get("expires"));
  const signature = url.searchParams.get("sig") ?? "";
  const now = Math.floor(Date.now() / 1_000);

  if (
    !Number.isInteger(expires) ||
    expires < now ||
    expires > now + PUBLIC_LINK_MAX_SECONDS
  ) {
    return json(request, env, { code: "LINK_EXPIRED" }, 401);
  }

  const expected = await hmac(
    `${key}\n${expires}`,
    env.CACHE_SIGNING_SECRET,
  );
  if (!constantTimeEqual(signature, expected)) {
    return json(request, env, { code: "INVALID_SIGNATURE" }, 401);
  }

  return readCache(request, env, key, true);
}

async function handlePrivate(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  if (request.method === "GET" || request.method === "HEAD") {
    const bodyHash = await sha256("");
    if (!(await verifyServiceRequest(request, env, bodyHash))) {
      return json(request, env, { code: "UNAUTHORIZED" }, 401);
    }
    return readCache(request, env, key, false);
  }

  if (request.method !== "PUT") {
    return json(request, env, { code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const contentType = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    ?.trim();
  const expiration = Number(request.headers.get("x-wallcab-expiration"));
  const now = Math.floor(Date.now() / 1_000);
  const declaredLength = Number(request.headers.get("content-length") ?? 0);

  if (
    !contentType ||
    !allowedContentTypes.has(contentType) ||
    !Number.isInteger(expiration) ||
    expiration <= now ||
    expiration > now + 172_800 ||
    declaredLength > MAX_CACHE_BYTES
  ) {
    return json(request, env, { code: "INVALID_CACHE_WRITE" }, 400);
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_CACHE_BYTES) {
    return json(request, env, { code: "INVALID_CACHE_SIZE" }, 413);
  }

  const bodyHash = await sha256(body);
  if (!(await verifyServiceRequest(request, env, bodyHash))) {
    return json(request, env, { code: "UNAUTHORIZED" }, 401);
  }

  const metadata: CacheMetadata = {
    contentType,
    etag: bodyHash,
    storedAt: new Date().toISOString(),
  };
  await env.WALLPAPERS.put(key, body, { expiration, metadata });

  return json(
    request,
    env,
    { ok: true, key, byteLength: body.byteLength, expiration },
    201,
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(request, env),
          "Access-Control-Allow-Headers":
            "Content-Type, X-WallCab-Body-Sha256, X-WallCab-Expiration, X-WallCab-Signature, X-WallCab-Timestamp",
          "Access-Control-Allow-Methods": "GET, HEAD, PUT, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const pathname = new URL(request.url).pathname;
    const publicKey = parseKey(pathname, "/v1/wallpapers/");
    if (publicKey && ["GET", "HEAD"].includes(request.method)) {
      return handlePublic(request, env, publicKey);
    }

    const privateKey = parseKey(pathname, "/v1/cache/");
    if (privateKey) {
      return handlePrivate(request, env, privateKey);
    }

    return json(request, env, { code: "NOT_FOUND" }, 404);
  },
} satisfies ExportedHandler<Env>;
