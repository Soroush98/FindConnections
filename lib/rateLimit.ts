/**
 * Fixed-window in-memory rate limiter.
 *
 * Keyed by an arbitrary string (typically `bucket:ip`). Suitable for a
 * single-instance self-hosted deployment (`next start`) — state lives in the
 * middleware isolate's memory. A horizontally-scaled deployment needs a shared
 * store (Redis) instead; the interface here is intentionally swap-compatible.
 *
 * Memory is bounded by a lazy sweep that drops expired buckets.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms when the current window resets. */
  resetAt: number;
}

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Record one hit against `key` and report whether it is within `limit` per
 * `windowMs`. `now` is injectable for deterministic tests.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, limit, remaining: limit - 1, resetAt };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/** Test hook — clear all limiter state. */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}
