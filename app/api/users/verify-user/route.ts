import { NextResponse } from 'next/server';
import { userService } from '@/lib/services';
import { withErrorHandler } from '@/lib/errors';
import { cookies } from 'next/headers';

async function handler(): Promise<NextResponse> {
  const userInfo = await userService.getCurrentUser();

  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  return NextResponse.json({
    ...userInfo,
    token,
  });
}

export const GET = withErrorHandler(handler);
