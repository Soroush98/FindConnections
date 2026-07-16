/**
 * TC-API-PICS — GET /api/general/famous-pics (traces: R4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const readdirMock = vi.fn();

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    promises: { ...actual.promises, readdir: (...args: unknown[]) => readdirMock(...args) },
  };
});

import { GET } from '@/app/api/general/famous-pics/route';
import { getRequest } from '../helpers/testUtils';
import { FamousPicsResponseSchema, expectContract } from '../helpers/contracts';

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('GET /api/general/famous-pics (TC-API-PICS-001)', () => {
  it('returns only allowed image extensions, sorted', async () => {
    readdirMock.mockResolvedValue([
      'zeta.jpg',
      'alpha.PNG', // case-insensitive extension check
      'notes.txt', // filtered
      '.DS_Store', // filtered
      'beta.webp',
      'script.js', // filtered
      'gamma.jpeg',
    ]);

    const res = await GET(getRequest('/api/general/famous-pics'));
    expect(res.status).toBe(200);
    const body = expectContract(FamousPicsResponseSchema, await res.json());
    expect(body.pics).toEqual(['alpha.PNG', 'beta.webp', 'gamma.jpeg', 'zeta.jpg']);
    expect(res.headers.get('Cache-Control')).toContain('max-age=300');
  });

  it('returns an empty list for an empty directory', async () => {
    readdirMock.mockResolvedValue([]);
    const res = await GET(getRequest('/api/general/famous-pics'));
    expect((await res.json()).pics).toEqual([]);
  });

  it('maps a missing directory to a generic 500 without leaking the path', async () => {
    readdirMock.mockRejectedValue(
      Object.assign(new Error("ENOENT: no such file or directory, scandir '/srv/app/public/Famous-pics'"), {
        code: 'ENOENT',
      })
    );
    const res = await GET(getRequest('/api/general/famous-pics'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(body)).not.toContain('/srv/app');
  });
});
