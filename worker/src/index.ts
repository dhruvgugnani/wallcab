type WorkerEnv = Env & {
  CACHE_WORKER_SECRET: string;
  CACHE_SIGNING_SECRET: string;
};

type CacheMetadata = {
  contentType: string;
  etag: string;
  storedAt: string;
};

type CustomBackgroundMetadata = {
  createdAt: string;
  deleteTokenHash: string;
  lastUsedAt: string;
  lastUsedDate: string;
};

type CustomBackgroundObjectMetadata = {
  byteLength: number;
  createdAt: string;
  deleteTokenHash: string;
  etag: string;
};

type WallpaperRunEvent = {
  requestId: string;
  outcome: "success" | "failure";
  delivery: "cache_hit" | "generated" | "bypass" | "error";
  contentMode: "external" | "fallback";
  category: string;
  theme: string;
  size: string;
  status: number;
};

const MAX_CACHE_BYTES = 5 * 1024 * 1024;
const MAX_CUSTOM_BACKGROUND_BYTES = 4 * 1024 * 1024;
const MAX_ANALYTICS_BODY_BYTES = 2 * 1024;
const MAX_AUTH_SKEW_SECONDS = 300;
const PUBLIC_LINK_MAX_SECONDS = 600;
const ANALYTICS_EVENT_PATH = "/v1/analytics/runs";
const CUSTOM_METADATA_PREFIX = "custom-background/v1/";
const CUSTOM_OBJECT_PREFIX = "custom/";
const CUSTOM_INACTIVE_SECONDS = 30 * 24 * 60 * 60;
const CUSTOM_METADATA_TTL_SECONDS = 40 * 24 * 60 * 60;
const analyticsOutcomes = new Set(["success", "failure"]);
const analyticsDeliveries = new Set([
  "cache_hit",
  "generated",
  "bypass",
  "error",
]);
const analyticsContentModes = new Set(["external", "fallback"]);
const analyticsEventKeys = [
  "requestId",
  "outcome",
  "delivery",
  "contentMode",
  "category",
  "theme",
  "size",
  "status",
] as const;
const analyticsCategories = new Set([
  "vocabulary",
  "coding",
  "finance",
  "stoicism",
  "science",
  "history",
  "psychology",
  "productivity",
]);
const analyticsThemes = new Set([
  "nature",
  "mountains",
  "ocean",
  "forest",
  "space",
  "amoled",
  "minimal",
  "abstract",
  "gradient",
  "monochrome",
  "grid",
]);
const analyticsSizes = new Set(["standard", "air", "max"]);
const allowedContentTypes = new Set([
  "application/json",
  "image/jpeg",
  "image/png",
  "image/svg+xml",
  "image/webp",
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

function corsHeaders(request: Request, env: WorkerEnv): HeadersInit {
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
  env: WorkerEnv,
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
  env: WorkerEnv,
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

function isWallpaperRunEvent(value: unknown): value is WallpaperRunEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const keys = Object.keys(value);
  if (
    keys.length !== analyticsEventKeys.length ||
    analyticsEventKeys.some((key) => !keys.includes(key))
  ) {
    return false;
  }
  const event = value as Partial<WallpaperRunEvent>;
  return Boolean(
    event.requestId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        event.requestId,
      ) &&
      event.outcome &&
      analyticsOutcomes.has(event.outcome) &&
      event.delivery &&
      analyticsDeliveries.has(event.delivery) &&
      event.contentMode &&
      analyticsContentModes.has(event.contentMode) &&
      event.category &&
      analyticsCategories.has(event.category) &&
      event.theme &&
      analyticsThemes.has(event.theme) &&
      event.size &&
      analyticsSizes.has(event.size) &&
      Number.isInteger(event.status) &&
      Number(event.status) >= 200 &&
      Number(event.status) <= 599,
  );
}

async function handleUsageEvent(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  if (request.method !== "POST") {
    return json(request, env, { code: "METHOD_NOT_ALLOWED" }, 405);
  }

  const declaredLength = Number(
    request.headers.get("content-length") ?? 0,
  );
  if (declaredLength > MAX_ANALYTICS_BODY_BYTES) {
    return json(request, env, { code: "INVALID_ANALYTICS_SIZE" }, 413);
  }

  const body = await request.arrayBuffer();
  if (
    body.byteLength === 0 ||
    body.byteLength > MAX_ANALYTICS_BODY_BYTES
  ) {
    return json(request, env, { code: "INVALID_ANALYTICS_SIZE" }, 413);
  }

  const bodyHash = await sha256(body);
  if (!(await verifyServiceRequest(request, env, bodyHash))) {
    return json(request, env, { code: "UNAUTHORIZED" }, 401);
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(new TextDecoder().decode(body));
  } catch {
    return json(request, env, { code: "INVALID_ANALYTICS_EVENT" }, 400);
  }
  if (!isWallpaperRunEvent(candidate)) {
    return json(request, env, { code: "INVALID_ANALYTICS_EVENT" }, 400);
  }

  env.USAGE_ANALYTICS.writeDataPoint({
    indexes: [candidate.requestId],
    blobs: [
      "wallpaper_run",
      candidate.outcome,
      candidate.delivery,
      candidate.contentMode,
      candidate.category,
      candidate.theme,
      candidate.size,
    ],
    doubles: [1, candidate.status],
  });

  return json(request, env, { accepted: true }, 202);
}

async function readCache(
  request: Request,
  env: WorkerEnv,
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
  env: WorkerEnv,
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
  env: WorkerEnv,
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

function parseCustomBackgroundId(
  pathname: string,
): string | null {
  const prefix = "/v1/custom-backgrounds/";
  if (!pathname.startsWith(prefix)) {
    return null;
  }

  try {
    const id = decodeURIComponent(pathname.slice(prefix.length));
    return /^[A-Za-z0-9_-]{22}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

function customObjectKey(id: string): string {
  return `${CUSTOM_OBJECT_PREFIX}${id}.webp`;
}

function customMetadataKey(id: string): string {
  return `${CUSTOM_METADATA_PREFIX}${id}`;
}

function validDeleteTokenHash(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function isCustomMetadata(
  value: unknown,
): value is CustomBackgroundMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }
  const metadata = value as Partial<CustomBackgroundMetadata>;
  return Boolean(
    metadata.createdAt &&
      metadata.lastUsedAt &&
      metadata.lastUsedDate &&
      metadata.deleteTokenHash &&
      validDeleteTokenHash(metadata.deleteTokenHash),
  );
}

function isCustomObjectMetadata(
  value: unknown,
): value is CustomBackgroundObjectMetadata {
  if (!value || typeof value !== "object") {
    return false;
  }
  const metadata = value as Partial<CustomBackgroundObjectMetadata>;
  return Boolean(
    metadata.createdAt &&
      Number.isFinite(Date.parse(metadata.createdAt)) &&
      metadata.deleteTokenHash &&
      validDeleteTokenHash(metadata.deleteTokenHash) &&
      metadata.etag &&
      /^[a-f0-9]{64}$/.test(metadata.etag) &&
      Number.isInteger(metadata.byteLength) &&
      Number(metadata.byteLength) > 0 &&
      Number(metadata.byteLength) <= MAX_CUSTOM_BACKGROUND_BYTES,
  );
}

async function putCustomMetadata(
  env: WorkerEnv,
  id: string,
  metadata: CustomBackgroundMetadata,
  nowSeconds: number,
): Promise<void> {
  await env.WALLPAPERS.put(customMetadataKey(id), "", {
    expiration: nowSeconds + CUSTOM_METADATA_TTL_SECONDS,
    metadata,
  });
}

async function touchCustomBackground(
  env: WorkerEnv,
  id: string,
  createdAt: string,
  deleteTokenHash: string,
): Promise<void> {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const existing =
    await env.WALLPAPERS.getWithMetadata<CustomBackgroundMetadata>(
      customMetadataKey(id),
      "text",
    );

  if (
    isCustomMetadata(existing.metadata) &&
    existing.metadata.lastUsedDate === today
  ) {
    return;
  }

  await putCustomMetadata(
    env,
    id,
    {
      createdAt,
      deleteTokenHash,
      lastUsedAt: now.toISOString(),
      lastUsedDate: today,
    },
    Math.floor(now.getTime() / 1_000),
  );
}

async function purgeCustomWallpaperCache(
  env: WorkerEnv,
  id: string,
): Promise<number> {
  let cursor: string | undefined;
  let deleted = 0;

  do {
    const page = await env.WALLPAPERS.list({
      prefix: "wallpaper/",
      ...(cursor ? { cursor } : {}),
    });
    const matching = page.keys
      .map((key) => key.name)
      .filter((key) => key.includes(`/custom/${id}/`));
    await Promise.all(
      matching.map((key) => env.WALLPAPERS.delete(key)),
    );
    deleted += matching.length;
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return deleted;
}

async function deleteCustomBackgroundValue(
  env: WorkerEnv,
  id: string,
): Promise<void> {
  await Promise.all([
    env.WALLPAPERS.delete(customObjectKey(id)),
    env.WALLPAPERS.delete(customMetadataKey(id)),
    purgeCustomWallpaperCache(env, id),
  ]);
}

async function handleCustomBackground(
  request: Request,
  env: WorkerEnv,
  id: string,
  ctx: ExecutionContext,
): Promise<Response> {
  const declaredLength = Number(
    request.headers.get("content-length") ?? 0,
  );
  if (
    request.method === "PUT" &&
    declaredLength > MAX_CUSTOM_BACKGROUND_BYTES
  ) {
    return json(
      request,
      env,
      { code: "INVALID_CUSTOM_BACKGROUND_SIZE" },
      413,
    );
  }

  const requestBody =
    request.method === "PUT" ? await request.arrayBuffer() : null;
  if (
    requestBody &&
    (requestBody.byteLength === 0 ||
      requestBody.byteLength > MAX_CUSTOM_BACKGROUND_BYTES)
  ) {
    return json(
      request,
      env,
      { code: "INVALID_CUSTOM_BACKGROUND_SIZE" },
      413,
    );
  }
  const bodyHash = await sha256(requestBody ?? "");
  if (!(await verifyServiceRequest(request, env, bodyHash))) {
    return json(request, env, { code: "UNAUTHORIZED" }, 401);
  }

  if (request.method === "GET" || request.method === "HEAD") {
    const stored =
      await env.WALLPAPERS.getWithMetadata<CustomBackgroundObjectMetadata>(
        customObjectKey(id),
        "arrayBuffer",
      );
    if (
      !stored.value ||
      !isCustomObjectMetadata(stored.metadata)
    ) {
      return json(request, env, { code: "NOT_FOUND" }, 404);
    }

    ctx.waitUntil(
      touchCustomBackground(
        env,
        id,
        stored.metadata.createdAt,
        stored.metadata.deleteTokenHash,
      ).catch((error: unknown) => {
        console.warn(
          JSON.stringify({
            event: "wallcab.custom_background",
            action: "touch_failed",
            reason:
              error instanceof Error ? error.message : "unknown",
          }),
        );
      }),
    );

    const headers = new Headers({
      ...corsHeaders(request, env),
      "Cache-Control": "private, no-store",
      "Content-Length": String(stored.value.byteLength),
      "Content-Type": "image/webp",
      ETag: `"${stored.metadata.etag}"`,
      "X-Content-Type-Options": "nosniff",
    });
    return new Response(
      request.method === "HEAD" ? null : stored.value,
      { status: 200, headers },
    );
  }

  if (request.method === "PUT") {
    const contentType = (request.headers.get("content-type") ?? "")
      .split(";")[0]
      ?.trim();
    const deleteTokenHash =
      request.headers.get("x-wallcab-delete-token-sha256") ?? "";

    if (
      contentType !== "image/webp" ||
      !validDeleteTokenHash(deleteTokenHash) ||
      declaredLength > MAX_CUSTOM_BACKGROUND_BYTES
    ) {
      return json(
        request,
        env,
        { code: "INVALID_CUSTOM_BACKGROUND_WRITE" },
        400,
      );
    }

    const now = new Date();
    const nowSeconds = Math.floor(now.getTime() / 1_000);
    const metadata: CustomBackgroundMetadata = {
      createdAt: now.toISOString(),
      deleteTokenHash,
      lastUsedAt: now.toISOString(),
      lastUsedDate: now.toISOString().slice(0, 10),
    };

    await env.WALLPAPERS.put(
      customObjectKey(id),
      requestBody!,
      {
        metadata: {
          byteLength: requestBody!.byteLength,
          createdAt: metadata.createdAt,
          deleteTokenHash,
          etag: bodyHash,
        },
      },
    );
    try {
      await putCustomMetadata(env, id, metadata, nowSeconds);
    } catch (error) {
      await env.WALLPAPERS.delete(customObjectKey(id));
      throw error;
    }

    return json(
      request,
      env,
      { ok: true, byteLength: requestBody!.byteLength },
      201,
    );
  }

  if (request.method === "DELETE") {
    const providedHash =
      request.headers.get("x-wallcab-delete-token-sha256") ?? "";
    if (!validDeleteTokenHash(providedHash)) {
      return json(request, env, { code: "NOT_FOUND" }, 404);
    }

    const [object, stored] = await Promise.all([
      env.WALLPAPERS.getWithMetadata<CustomBackgroundObjectMetadata>(
        customObjectKey(id),
        "arrayBuffer",
      ),
      env.WALLPAPERS.getWithMetadata<CustomBackgroundMetadata>(
        customMetadataKey(id),
        "text",
      ),
    ]);
    const expectedHash = isCustomMetadata(stored.metadata)
      ? stored.metadata.deleteTokenHash
      : isCustomObjectMetadata(object.metadata)
        ? object.metadata.deleteTokenHash
        : "";
    if (
      !object.value ||
      !validDeleteTokenHash(expectedHash) ||
      !constantTimeEqual(providedHash, expectedHash)
    ) {
      return json(request, env, { code: "NOT_FOUND" }, 404);
    }

    await deleteCustomBackgroundValue(env, id);
    return json(request, env, { ok: true }, 200);
  }

  return json(request, env, { code: "METHOD_NOT_ALLOWED" }, 405);
}

async function cleanupCustomBackgrounds(
  env: WorkerEnv,
  now = Date.now(),
): Promise<{ inactive: number; orphans: number }> {
  const inactiveCutoff = now - CUSTOM_INACTIVE_SECONDS * 1_000;
  const orphanCutoff = now - CUSTOM_METADATA_TTL_SECONDS * 1_000;
  const activeIds = new Set<string>();
  let inactive = 0;
  let kvCursor: string | undefined;

  do {
    const page =
      await env.WALLPAPERS.list<CustomBackgroundMetadata>({
        prefix: CUSTOM_METADATA_PREFIX,
        ...(kvCursor ? { cursor: kvCursor } : {}),
      });
    for (const key of page.keys) {
      const id = key.name.slice(CUSTOM_METADATA_PREFIX.length);
      if (!/^[A-Za-z0-9_-]{22}$/.test(id)) {
        await env.WALLPAPERS.delete(key.name);
        continue;
      }
      if (
        isCustomMetadata(key.metadata) &&
        Date.parse(key.metadata.lastUsedAt) > inactiveCutoff
      ) {
        activeIds.add(id);
        continue;
      }

      await deleteCustomBackgroundValue(env, id);
      inactive += 1;
    }
    kvCursor = page.list_complete ? undefined : page.cursor;
  } while (kvCursor);

  let orphans = 0;
  let objectCursor: string | undefined;
  do {
    const page =
      await env.WALLPAPERS.list<CustomBackgroundObjectMetadata>({
        prefix: CUSTOM_OBJECT_PREFIX,
        ...(objectCursor ? { cursor: objectCursor } : {}),
      });
    const expiredOrphans = page.keys.filter((object) => {
      const filename = object.name.slice(CUSTOM_OBJECT_PREFIX.length);
      const id = filename.endsWith(".webp")
        ? filename.slice(0, -5)
        : "";
      return (
        !/^[A-Za-z0-9_-]{22}$/.test(id) ||
        (!activeIds.has(id) &&
          (!isCustomObjectMetadata(object.metadata) ||
            Date.parse(object.metadata.createdAt) <= orphanCutoff))
      );
    });
    if (expiredOrphans.length > 0) {
      await Promise.all(
        expiredOrphans.map((object) =>
          env.WALLPAPERS.delete(object.name),
        ),
      );
    }
    orphans += expiredOrphans.length;
    objectCursor = page.list_complete ? undefined : page.cursor;
  } while (objectCursor);

  return { inactive, orphans };
}

export default {
  async fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders(request, env),
          "Access-Control-Allow-Headers":
            "Content-Type, X-WallCab-Body-Sha256, X-WallCab-Delete-Token-Sha256, X-WallCab-Expiration, X-WallCab-Signature, X-WallCab-Timestamp",
          "Access-Control-Allow-Methods":
            "DELETE, GET, HEAD, POST, PUT, OPTIONS",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const pathname = new URL(request.url).pathname;
    if (pathname === ANALYTICS_EVENT_PATH) {
      return handleUsageEvent(request, env);
    }

    const customBackgroundId = parseCustomBackgroundId(pathname);
    if (customBackgroundId) {
      return handleCustomBackground(
        request,
        env,
        customBackgroundId,
        ctx,
      );
    }

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

  async scheduled(
    _controller: ScheduledController,
    env: WorkerEnv,
  ): Promise<void> {
    const result = await cleanupCustomBackgrounds(env);
    console.info(
      JSON.stringify({
        event: "wallcab.custom_background_cleanup",
        ...result,
      }),
    );
  },
} satisfies ExportedHandler<WorkerEnv>;
