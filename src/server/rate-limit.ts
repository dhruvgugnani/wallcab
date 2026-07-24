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
): RateLimitResult {
  const existing = windows.get(key);
  const current =
    !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + WINDOW_MS }
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
    allowed: current.count <= LIMIT,
    limit: LIMIT,
    remaining: Math.max(0, LIMIT - current.count),
    resetAt: Math.floor(current.resetAt / 1_000),
  };
}
