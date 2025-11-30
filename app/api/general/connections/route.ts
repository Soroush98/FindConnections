import { NextRequest, NextResponse } from 'next/server';
import { connectionService } from '@/lib/services';
import { withErrorHandler, AppError } from '@/lib/errors';

async function handler(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const name1 = searchParams.get('name1');
  const name2 = searchParams.get('name2');

  if (!name1 || !name2) {
    throw AppError.missingFields(['name1', 'name2']);
  }

  const connections = await connectionService.findConnections(name1, name2);
  return NextResponse.json(connections);
}

export const GET = withErrorHandler(handler);