import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userService } from '@/lib/services';
import { userRepository } from '@/lib/repositories';
import { withErrorHandler, AppError } from '@/lib/errors';

async function handler(req: NextRequest): Promise<NextResponse> {
  const { enabled } = await req.json();
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    throw AppError.unauthorized();
  }

  const decoded = userService.verifyToken(token);
  if (decoded.role !== 'user') {
    throw AppError.forbidden();
  }

  await userRepository.updateNotificationPreference(decoded.id, enabled);

  return NextResponse.json({ message: 'Notification preference updated successfully' }, { status: 200 });
}

export const POST = withErrorHandler(handler);
