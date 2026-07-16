import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/rateLimit';

// Public read API: generous enough for keystroke-driven autocomplete from a
// real user, tight enough to stop a single client from hammering the
// Levenshtein/shortestPath paths. Tuned per-IP; see lib/rateLimit.ts.
const GENERAL_LIMIT = 300;
const GENERAL_WINDOW_MS = 60_000;

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/admin-upload' ||
    pathname.startsWith('/admin-upload/') ||
    pathname === '/api/admin/admin-login'
  ) {
    return new NextResponse('Not found', { status: 404 });
  }

  if (pathname.startsWith('/api/general/')) {
    const result = checkRateLimit(`general:${clientIp(req)}`, GENERAL_LIMIT, GENERAL_WINDOW_MS);
    if (!result.allowed) {
      const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
      return NextResponse.json(
        { error: 'Too many requests', code: 'RATE_LIMITED' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }
    const res = NextResponse.next();
    res.headers.set('X-RateLimit-Limit', String(result.limit));
    res.headers.set('X-RateLimit-Remaining', String(result.remaining));
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/admin-upload',
    '/admin-upload/:path*',
    '/api/admin/admin-login',
    '/api/general/:path*',
  ],
};
