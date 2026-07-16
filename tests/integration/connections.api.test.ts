/**
 * TC-API-CONN — GET /api/general/connections (traces: R4, R5, R10).
 * Route handler invoked through NextRequest with the service seam mocked.
 * Negative cases are half the suite: missing params, dependency failure.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/services', () => ({
  connectionService: { findConnections: vi.fn() },
  adminService: {},
  suggestionService: {},
  ingestionService: {},
}));

import { GET } from '@/app/api/general/connections/route';
import { connectionService } from '@/lib/services';
import { getRequest } from '../helpers/testUtils';
import {
  ConnectionsResponseSchema,
  ErrorBodySchema,
  expectContract,
} from '../helpers/contracts';

const findConnections = vi.mocked(connectionService.findConnections);

const PATH = '/api/general/connections';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('happy path (TC-API-CONN-001)', () => {
  it('returns the path list and honors the response contract', async () => {
    findConnections.mockResolvedValue([
      {
        segments: [
          { start: 'A B', relationship: 'PHOTOGRAPHED_WITH', end: 'C D', imageUrl: 'https://x/1.jpg' },
        ],
        imageUrls: ['https://x/1.jpg'],
      },
    ]);

    const res = await GET(getRequest(PATH, { name1: 'A B', name2: 'C D' }));

    expect(res.status).toBe(200);
    const body = expectContract(ConnectionsResponseSchema, await res.json());
    expect(body[0].segments[0].start).toBe('A B');
    expect(findConnections).toHaveBeenCalledWith('A B', 'C D');
  });

  it('returns an empty array (not an error) when no path exists', async () => {
    findConnections.mockResolvedValue([]);
    const res = await GET(getRequest(PATH, { name1: 'A B', name2: 'Z Z' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });
});

describe('negative cases (TC-API-CONN-002)', () => {
  it.each([
    ['name1 missing', { name2: 'C D' }],
    ['name2 missing', { name1: 'A B' }],
    ['both missing', {}],
    ['name1 empty string', { name1: '', name2: 'C D' }],
  ])('%s → 400 MISSING_REQUIRED_FIELDS with contract-valid error body', async (_label, params) => {
    const res = await GET(getRequest(PATH, params as Record<string, string>));
    expect(res.status).toBe(400);
    const body = expectContract(ErrorBodySchema, await res.json());
    expect(body.code).toBe('MISSING_REQUIRED_FIELDS');
    expect(findConnections).not.toHaveBeenCalled();
  });

  it('maps a database failure to a generic 500 with no internals leaked (TC-API-CONN-003)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    findConnections.mockRejectedValue(
      new Error('Neo4jError: connection refused bolt://10.0.0.5:7687')
    );

    const res = await GET(getRequest(PATH, { name1: 'A B', name2: 'C D' }));
    expect(res.status).toBe(500);
    const body = expectContract(ErrorBodySchema, await res.json());
    expect(body).toEqual({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(body)).not.toContain('bolt://');
    consoleSpy.mockRestore();
  });
});
