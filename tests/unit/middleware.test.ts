/**
 * TC-MW — middleware admin-hiding + public-API rate limiting
 * (traces: R1, R5, R8; fixes DEF-008).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { resetRateLimits } from '@/lib/rateLimit';

function req(path: string, ip = '203.0.113.1') {
  return new NextRequest(`https://findconnections.net${path}`, {
    headers: { 'x-forwarded-for': ip },
  });
}

beforeEach(() => {
  resetRateLimits();
});

describe('admin-surface hiding (TC-MW-001)', () => {
  it.each([
    '/admin',
    '/admin/',
    '/admin/anything',
    '/admin-upload',
    '/admin-upload/nested/deep',
    '/api/admin/admin-login',
  ])('hides %s with a 404', (path) => {
    expect(middleware(req(path)).status).toBe(404);
  });

  it.each(['/', '/connections', '/api/admin/verify-session'])('passes %s through', (path) => {
    expect(middleware(req(path)).status).not.toBe(404);
  });

  it('does NOT 404 the other /api/admin/* routes — they enforce via JWT (defense in depth)', () => {
    expect(middleware(req('/api/admin/admin-upload')).status).not.toBe(404);
    expect(middleware(req('/api/admin/ingest-pair')).status).not.toBe(404);
  });
});

describe('public-API rate limiting (TC-MW-002, DEF-008 fixed)', () => {
  it('passes requests under the limit and exposes remaining budget', () => {
    const res = middleware(req('/api/general/popular'));
    expect(res.status).not.toBe(429);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('300');
    expect(Number(res.headers.get('X-RateLimit-Remaining'))).toBe(299);
  });

  it('429s the 301st request from the same IP within the window', () => {
    let last = middleware(req('/api/general/suggestions'));
    for (let i = 0; i < 299; i++) last = middleware(req('/api/general/suggestions'));
    expect(last.status).not.toBe(429); // 300th still allowed

    const blocked = middleware(req('/api/general/suggestions'));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeDefined();
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('returns a contract-shaped RATE_LIMITED body when throttled', async () => {
    for (let i = 0; i < 300; i++) middleware(req('/api/general/popular'));
    const blocked = middleware(req('/api/general/popular'));
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'Too many requests', code: 'RATE_LIMITED' });
  });

  it('meters per-IP: a second IP is unaffected by the first IP hitting the limit', () => {
    for (let i = 0; i < 305; i++) middleware(req('/api/general/popular', '198.51.100.7'));
    const other = middleware(req('/api/general/popular', '203.0.113.9'));
    expect(other.status).not.toBe(429);
  });

  it('does not rate-limit non-general paths', () => {
    for (let i = 0; i < 305; i++) middleware(req('/api/admin/verify-session'));
    expect(middleware(req('/api/admin/verify-session')).status).not.toBe(429);
  });
});
