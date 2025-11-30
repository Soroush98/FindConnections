import { NextResponse } from 'next/server';
import { suggestionService } from '@/lib/services';
import { withErrorHandler } from '@/lib/errors';

async function handler(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';

  const suggestions = await suggestionService.getSuggestions(query);

  // Return the response with client caching headers
  return NextResponse.json(
    { suggestions },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=30' } }
  );
}

export const GET = withErrorHandler(handler);
