import { NextResponse } from 'next/server';
import { suggestionService } from '@/lib/services';
import { withErrorHandler } from '@/lib/errors';

const DEFAULT_LIMIT = 8;
const HARD_MAX = 20;

async function handler(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const raw = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(raw) && raw > 0 ? Math.min(HARD_MAX, Math.floor(raw)) : DEFAULT_LIMIT;

  const names = await suggestionService.getPopularNames(limit);

  return NextResponse.json(
    { names },
    { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' } }
  );
}

export const GET = withErrorHandler(handler);
