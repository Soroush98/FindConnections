/**
 * TC-RL — fixed-window rate limiter (traces: R5, R8; supports DEF-008).
 * Technique: boundary-value analysis at the exact limit and window edge;
 * `now` is injected for determinism (no timers, no flakiness).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, resetRateLimits } from '@/lib/rateLimit';

beforeEach(() => {
  resetRateLimits();
});

describe('checkRateLimit (TC-RL-001)', () => {
  it('allows exactly `limit` hits then blocks the next (boundary)', () => {
    const now = 1_000_000;
    for (let i = 1; i <= 5; i++) {
      const r = checkRateLimit('ip:a', 5, 60_000, now);
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(5 - i);
    }
    const sixth = checkRateLimit('ip:a', 5, 60_000, now);
    expect(sixth.allowed).toBe(false);
    expect(sixth.remaining).toBe(0);
  });

  it('resets once the window elapses (boundary at resetAt)', () => {
    const start = 1_000_000;
    for (let i = 0; i < 5; i++) checkRateLimit('ip:b', 5, 60_000, start);
    expect(checkRateLimit('ip:b', 5, 60_000, start + 59_999).allowed).toBe(false); // still in window
    expect(checkRateLimit('ip:b', 5, 60_000, start + 60_000).allowed).toBe(true); // window rolled over
  });

  it('meters keys independently', () => {
    const now = 2_000_000;
    for (let i = 0; i < 5; i++) checkRateLimit('ip:c', 5, 60_000, now);
    expect(checkRateLimit('ip:c', 5, 60_000, now).allowed).toBe(false);
    expect(checkRateLimit('ip:d', 5, 60_000, now).allowed).toBe(true);
  });

  it('reports resetAt as window start + windowMs', () => {
    const now = 3_000_000;
    expect(checkRateLimit('ip:e', 10, 60_000, now).resetAt).toBe(now + 60_000);
  });
});
