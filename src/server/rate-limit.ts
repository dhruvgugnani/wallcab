type WindowRecord = {
  count: number;
  resetAt: number;
};

const windows = new Map<string, WindowRecord>();
const WINDOW_MS = 60_000;
const LIMIT = 60;

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};

export function checkRateLimit(
  key: string,
  now = Date.now(),
  limit = LIMIT,
  windowMs = WINDOW_MS,
): RateLimitResult {
  const existing = windows.get(key);
  const current =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : existing;

  current.count += 1;
  windows.set(key, current);

  if (windows.size > 2_000) {
    for (const [candidate, record] of windows) {
      if (record.resetAt <= now) {
        windows.delete(candidate);
      }
    }
  }

  return {
    allowed: current.count <= limit,
    limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: Math.floor(current.resetAt / 1_000),
  };
}
