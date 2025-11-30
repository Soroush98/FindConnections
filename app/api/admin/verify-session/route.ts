import { NextResponse } from 'next/server';
import { adminService } from '@/lib/services';
import { withErrorHandler } from '@/lib/errors';

async function handler(): Promise<NextResponse> {
  const { email } = await adminService.verifySession();

  return NextResponse.json({ message: 'Authenticated', email }, { status: 200 });
}

export const GET = withErrorHandler(handler);
