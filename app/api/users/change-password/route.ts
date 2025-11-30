import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { userService } from '@/lib/services';
import { withErrorHandler, AppError } from '@/lib/errors';
import { extractCsrfToken, validateCsrfToken } from '@/helpers/csrfHelper';

async function handler(req: NextRequest): Promise<NextResponse> {
  // Extract and validate CSRF token using helper
  const providedToken = await extractCsrfToken(req);

  if (!providedToken || !(await validateCsrfToken(req, providedToken))) {
    throw AppError.forbidden('Invalid CSRF token');
  }

  const { currentPassword, newPassword } = await req.json();
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (!token) {
    throw AppError.unauthorized();
  }

  const decoded = userService.verifyToken(token);

  if (decoded.role !== 'user') {
    throw AppError.forbidden();
  }

  await userService.changePassword(decoded.id, currentPassword, newPassword);

  return NextResponse.json({ message: 'Password changed successfully' }, { status: 200 });
}

export const POST = withErrorHandler(handler);
