/**
 * TC-API-INGEST — POST /api/admin/ingest-pair (traces: R1, R6).
 * BVA on maxCandidates clamping (default 15, hard max 30, floor 1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '@/lib/errors';

vi.mock('@/lib/services', () => ({
  adminService: { verifySession: vi.fn() },
  ingestionService: { ingestPair: vi.fn() },
  connectionService: {},
  suggestionService: {},
}));

import { POST } from '@/app/api/admin/ingest-pair/route';
import { adminService, ingestionService } from '@/lib/services';
import { postJson } from '../helpers/testUtils';
import { ErrorBodySchema, IngestResultSchema, expectContract } from '../helpers/contracts';

const verifySession = vi.mocked(adminService.verifySession);
const ingestPair = vi.mocked(ingestionService.ingestPair);
const PATH = '/api/admin/ingest-pair';

beforeEach(() => {
  vi.clearAllMocks();
  verifySession.mockResolvedValue({ email: 'admin@test.com', role: 'admin' });
  ingestPair.mockResolvedValue({ added: false, attempts: [] });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('authentication (TC-API-INGEST-001)', () => {
  it('401s without a valid session and never calls the pipeline', async () => {
    verifySession.mockRejectedValue(AppError.unauthorized());
    const res = await POST(postJson(PATH, { personA: 'John Doe', personB: 'Jane Roe' }));
    expect(res.status).toBe(401);
    expect(ingestPair).not.toHaveBeenCalled();
  });
});

describe('input validation (TC-API-INGEST-002)', () => {
  it('malformed JSON → 400, not 500', async () => {
    const res = await POST(postJson(PATH, '{oops'));
    expect(res.status).toBe(400);
    expectContract(ErrorBodySchema, await res.json());
  });

  it.each([
    ['missing personA', { personB: 'Jane Roe' }],
    ['missing personB', { personA: 'John Doe' }],
    ['empty body', {}],
  ])('%s → 400 MISSING_REQUIRED_FIELDS', async (_label, body) => {
    const res = await POST(postJson(PATH, body));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('MISSING_REQUIRED_FIELDS');
  });

  it.each([
    ['single word', 'Prince'],
    ['digits', 'Jay Z9'],
    ['injection', "a' })-[]-() //"],
  ])('bad name format (%s) → 400 without reaching the pipeline', async (_label, bad) => {
    const res = await POST(postJson(PATH, { personA: bad, personB: 'Jane Roe' }));
    expect(res.status).toBe(400);
    expect(ingestPair).not.toHaveBeenCalled();
  });
});

describe('maxCandidates clamping (TC-API-INGEST-003, BVA)', () => {
  it.each([
    ['unset → default', undefined, 15],
    ['1 (min)', 1, 1],
    ['0 → clamped up', 0, 1],
    ['-10 → clamped up', -10, 1],
    ['30 (max)', 30, 30],
    ['31 → clamped down', 31, 30],
    ['1000 → clamped down', 1000, 30],
    ['7.9 → floored', 7.9, 7],
    ['non-number string → default', '25' as unknown as number, 15],
  ])('maxCandidates=%s → pipeline receives %d', async (_label, input, expected) => {
    const body: Record<string, unknown> = { personA: 'John Doe', personB: 'Jane Roe' };
    if (input !== undefined) body.maxCandidates = input;

    const res = await POST(postJson(PATH, body));
    expect(res.status).toBe(200);
    expect(ingestPair).toHaveBeenCalledWith('John Doe', 'Jane Roe', expected);
  });
});

describe('result passthrough (TC-API-INGEST-004)', () => {
  it('returns the pipeline result under the published contract', async () => {
    ingestPair.mockResolvedValue({
      added: true,
      imageUrl: 'https://x/John Doe_Jane Roe.jpg',
      attempts: [
        { url: 'https://img/1.jpg', status: 'skipped', reason: 'download failed: HTTP 404' },
        { url: 'https://img/2.jpg', status: 'accepted', detected: ['John Doe', 'Jane Roe'] },
      ],
    });

    const res = await POST(postJson(PATH, { personA: 'John Doe', personB: 'Jane Roe' }));
    expect(res.status).toBe(200);
    const body = expectContract(IngestResultSchema, await res.json());
    expect(body.added).toBe(true);
    expect(body.attempts).toHaveLength(2);
  });

  it('maps pipeline validation errors (e.g. missing Serper key) to 400', async () => {
    ingestPair.mockRejectedValue(AppError.validation('SERPER_API_KEY is not configured'));
    const res = await POST(postJson(PATH, { personA: 'John Doe', personB: 'Jane Roe' }));
    expect(res.status).toBe(400);
  });
});
