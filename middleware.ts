import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/admin-upload',
    '/admin-upload/:path*',
    '/api/admin/admin-login',
  ],
};
