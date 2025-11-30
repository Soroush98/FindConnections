import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/services';
import { withErrorHandler } from '@/lib/errors';

async function handler(request: NextRequest): Promise<NextResponse> {
  const { Email, Password } = await request.json();

  // Get IP address for rate limiting
  const ip =
    request.headers.get('x-vercel-forwarded-for') ||
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const authToken = await userService.login(Email, Password, ip);

  // Set cookie via NextResponse object
  const response = NextResponse.json({ message: 'Login successful' });
  response.cookies.set({
    name: 'auth-token',
    value: authToken,
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day in seconds
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}

export const POST = withErrorHandler(handler);
