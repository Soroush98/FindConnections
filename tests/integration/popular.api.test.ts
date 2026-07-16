/**
 * TC-API-POP — GET /api/general/popular (traces: R4).
 * Technique: boundary-value analysis on the limit param
 * (default 8, hard max 20).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  suggestionService: { getPopularNames: vi.fn() },
  adminService: {},
  connectionService: {},
  ingestionService: {},
}));

import { GET } from '@/app/api/general/popular/route';
import { suggestionService } from '@/lib/services';
import { getRequest } from '../helpers/testUtils';
import { PopularResponseSchema, expectContract } from '../helpers/contracts';

const getPopularNames = vi.mocked(suggestionService.getPopularNames);
const PATH = '/api/general/popular';

beforeEach(() => {
  vi.clearAllMocks();
  getPopularNames.mockResolvedValue(['A B']);
});

describe('limit boundary analysis (TC-API-POP-001)', () => {
  it.each([
    // [raw query value, limit the service must receive]
    ['unset', undefined, 8], // default
    ['1 (min valid)', '1', 1],
    ['19 (max−1)', '19', 19],
    ['20 (exact max)', '20', 20],
    ['21 (max+1, clamped)', '21', 20],
    ['1000 (way over, clamped)', '1000', 20],
    ['0 (below min → default)', '0', 8],
    ['-5 (negative → default)', '-5', 8],
    ['7.9 (fractional, floored)', '7.9', 7],
    ['NaN text → default', 'abc', 8],
    ['Infinity → default', 'Infinity', 8],
  ])('limit=%s → service called with %d', async (_label, raw, expected) => {
    const params: Record<string, string> = raw === undefined ? {} : { limit: raw as string };
    const res = await GET(getRequest(PATH, params));
    expect(res.status).toBe(200);
    expect(getPopularNames).toHaveBeenCalledWith(expected);
  });

  it('response honors the contract and sets shared-cache headers (TC-API-POP-002)', async () => {
    getPopularNames.mockResolvedValue(['A B', 'C D']);
    const res = await GET(getRequest(PATH));
    const body = expectContract(PopularResponseSchema, await res.json());
    expect(body.names).toEqual(['A B', 'C D']);
    expect(res.headers.get('Cache-Control')).toContain('max-age=300');
  });
});
