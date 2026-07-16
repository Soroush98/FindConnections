/**
 * TC-API-SUGG — GET /api/general/suggestions (traces: R4, R5).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  suggestionService: { getSuggestions: vi.fn() },
  adminService: {},
  connectionService: {},
  ingestionService: {},
}));

import { GET } from '@/app/api/general/suggestions/route';
import { suggestionService } from '@/lib/services';
import { getRequest } from '../helpers/testUtils';
import { SuggestionsResponseSchema, expectContract } from '../helpers/contracts';

const getSuggestions = vi.mocked(suggestionService.getSuggestions);
const PATH = '/api/general/suggestions';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/general/suggestions', () => {
  it('returns contract-valid suggestions with client-cache headers (TC-API-SUGG-001)', async () => {
    getSuggestions.mockResolvedValue(['John Doe', 'John Legend']);

    const res = await GET(getRequest(PATH, { query: 'john' }));

    expect(res.status).toBe(200);
    const body = expectContract(SuggestionsResponseSchema, await res.json());
    expect(body.suggestions).toEqual(['John Doe', 'John Legend']);
    expect(res.headers.get('Cache-Control')).toContain('max-age=60');
  });

  it('treats a missing query param as empty query, not an error (TC-API-SUGG-002)', async () => {
    getSuggestions.mockResolvedValue([]);
    const res = await GET(getRequest(PATH));
    expect(res.status).toBe(200);
    expect(getSuggestions).toHaveBeenCalledWith('');
  });

  it('caps query length: a 10k-char query is rejected 400 before the Levenshtein loop (DEF-005 fixed)', async () => {
    getSuggestions.mockResolvedValue([]);
    const res = await GET(getRequest(PATH, { query: 'a'.repeat(10_000) }));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_ERROR');
    expect(getSuggestions).not.toHaveBeenCalled();
  });

  it('allows a query at the 100-char boundary (BVA)', async () => {
    getSuggestions.mockResolvedValue([]);
    const res = await GET(getRequest(PATH, { query: 'a'.repeat(100) }));
    expect(res.status).toBe(200);
    expect(getSuggestions).toHaveBeenCalledWith('a'.repeat(100));

    const over = await GET(getRequest(PATH, { query: 'a'.repeat(101) }));
    expect(over.status).toBe(400);
  });
});
