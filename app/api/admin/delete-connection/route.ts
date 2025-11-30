import { NextRequest, NextResponse } from 'next/server';
import { adminService, connectionService } from '@/lib/services';
import { withErrorHandler } from '@/lib/errors';

async function handler(req: NextRequest): Promise<NextResponse> {
  // Verify admin authentication
  await adminService.verifySession();

  // Get connection details from request
  const { firstPersonFullName, secondPersonFullName } = await req.json();

  await connectionService.deleteConnection(firstPersonFullName, secondPersonFullName);

  return NextResponse.json({ message: 'Connection deleted successfully' }, { status: 200 });
}

export const POST = withErrorHandler(handler);
