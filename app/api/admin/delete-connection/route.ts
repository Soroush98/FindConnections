import { NextRequest, NextResponse } from 'next/server';
import { adminService, connectionService } from '@/lib/services';
import { withErrorHandler, AppError } from '@/lib/errors';

async function handler(req: NextRequest): Promise<NextResponse> {
  // Verify admin authentication
  await adminService.verifySession();

  // Get connection details from request
  const body = await req.json().catch(() => {
    throw AppError.validation('Invalid JSON body');
  });
  const { firstPersonFullName, secondPersonFullName } = body ?? {};

  await connectionService.deleteConnection(firstPersonFullName, secondPersonFullName);

  return NextResponse.json({ message: 'Connection deleted successfully' }, { status: 200 });
}

export const POST = withErrorHandler(handler);
