import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/services';
import { withErrorHandler, AppError } from '@/lib/errors';

async function handler(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const password = searchParams.get('password');

  if (!email || !password) {
    throw AppError.missingFields(['email', 'password']);
  }

  const token = await adminService.login(email, password);

  // Set HTTP-only secure cookie
  const response = NextResponse.json({ message: 'Login successful' }, { status: 200 });
  response.cookies.set({
    name: 'admin-token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8, // 8 hours in seconds
    path: '/',
    sameSite: 'strict',
  });

  return response;
}

export const GET = withErrorHandler(handler);
