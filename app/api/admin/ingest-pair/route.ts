import { NextRequest, NextResponse } from 'next/server';
import { adminService, ingestionService } from '@/lib/services';
import { withErrorHandler, AppError } from '@/lib/errors';

const NAME_REGEX = /^[a-zA-Z]+\s[a-zA-Z]+$/;
const DEFAULT_MAX_CANDIDATES = 15;
const HARD_MAX_CANDIDATES = 30;

async function handler(req: NextRequest): Promise<NextResponse> {
  await adminService.verifySession();

  const body = (await req.json().catch(() => null)) as
    | { personA?: string; personB?: string; maxCandidates?: number }
    | null;

  if (!body || !body.personA || !body.personB) {
    throw AppError.missingFields(['personA', 'personB']);
  }

  if (!NAME_REGEX.test(body.personA) || !NAME_REGEX.test(body.personB)) {
    throw AppError.validation("Names must be in '{first} {last}' format using letters only");
  }

  const requested = typeof body.maxCandidates === 'number' ? body.maxCandidates : DEFAULT_MAX_CANDIDATES;
  const maxCandidates = Math.max(1, Math.min(HARD_MAX_CANDIDATES, Math.floor(requested)));

  const result = await ingestionService.ingestPair(body.personA, body.personB, maxCandidates);

  return NextResponse.json(result, { status: 200 });
}

export const POST = withErrorHandler(handler);

// Ingestion fetches+Rekognizes up to 15 images sequentially — bump function timeout.
export const maxDuration = 60;
