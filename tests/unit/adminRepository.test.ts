/**
 * TC-ADMREPO — admins table access (traces: R1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const maybeSingleMock = vi.fn();
const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));

vi.mock('@/lib/db', () => ({
  supabaseAdmin: { from: vi.fn(() => ({ select: selectMock })) },
}));

import { adminRepository } from '@/lib/repositories/adminRepository';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('findByEmail (TC-ADMREPO-001)', () => {
  it('maps a row to AdminInfo', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: 'u1', email: 'admin@test.com', password: 'hash' },
      error: null,
    });
    expect(await adminRepository.findByEmail('admin@test.com')).toEqual({
      Id: 'u1',
      Email: 'admin@test.com',
      Password: 'hash',
    });
    expect(eqMock).toHaveBeenCalledWith('email', 'admin@test.com');
  });

  it('returns null for a missing row', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    expect(await adminRepository.findByEmail('ghost@test.com')).toBeNull();
  });

  it('returns null for a row with a NULL password — that account cannot log in', async () => {
    maybeSingleMock.mockResolvedValue({
      data: { id: 'u1', email: 'admin@test.com', password: null },
      error: null,
    });
    expect(await adminRepository.findByEmail('admin@test.com')).toBeNull();
  });

  it('propagates database errors with operation context', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    await expect(adminRepository.findByEmail('a@t.com')).rejects.toThrow(
      'adminRepository.findByEmail: timeout'
    );
  });
});
