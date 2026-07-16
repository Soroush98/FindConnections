import { NextResponse } from 'next/server';
import { suggestionService } from '@/lib/services';
import { withErrorHandler, AppError } from '@/lib/errors';

// A real name query is short; cap the length so the O(query × names) similarity
// scan on this public, unauthenticated endpoint can't be turned into a CPU sink.
const MAX_QUERY_LENGTH = 100;

async function handler(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') || '';

  if (query.length > MAX_QUERY_LENGTH) {
    throw AppError.validation(`Query must be at most ${MAX_QUERY_LENGTH} characters`);
  }

  const suggestions = await suggestionService.getSuggestions(query);

  // Return the response with client caching headers
  return NextResponse.json(
    { suggestions },
    { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=30' } }
  );
}

export const GET = withErrorHandler(handler);
