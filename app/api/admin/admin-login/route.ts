import { NextRequest, NextResponse } from 'next/server';
import { adminService } from '@/lib/services';
import { withErrorHandler, AppError } from '@/lib/errors';

async function handler(req: NextRequest): Promise<NextResponse> {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    throw AppError.validation('Invalid JSON body');
  }

  const { email, password } = body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw AppError.missingFields(['email', 'password']);
  }

  const token = await adminService.login(email, password);

  const response = NextResponse.json({ message: 'Login successful' }, { status: 200 });
  response.cookies.set({
    name: 'admin-token',
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8,
    path: '/',
    sameSite: 'strict',
  });

  return response;
}

export const POST = withErrorHandler(handler);
