"use server";
import { NextRequest, NextResponse } from 'next/server';
import { userService } from '@/lib/services';
import { withErrorHandler } from '@/lib/errors';

async function handler(request: NextRequest): Promise<NextResponse> {
  const { token } = await request.json();

  await userService.confirmEmail(token);

  return NextResponse.json({ success: true });
}

export const POST = withErrorHandler(handler);