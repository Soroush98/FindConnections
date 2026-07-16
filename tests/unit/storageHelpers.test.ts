/**
 * TC-STOR — Supabase Storage helpers (traces: R2).
 * Covers key↔URL round-tripping and list pagination (the 1000-object page cap
 * is exactly where a silent truncation bug would hide).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listMock = vi.fn();
const uploadMock = vi.fn();
const removeMock = vi.fn();

vi.mock('@/lib/db/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: () => ({
        list: listMock,
        upload: uploadMock,
        remove: removeMock,
        getPublicUrl: (key: string) => ({
          data: {
            publicUrl: `https://test-project.supabase.co/storage/v1/object/public/connection-images/${encodeURIComponent(key)}`,
          },
        }),
      }),
    },
  },
}));

import { storageHelpers } from '@/lib/db/storage';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('keyFromPublicUrl (TC-STOR-001)', () => {
  it('round-trips publicUrl → keyFromPublicUrl, including names with spaces', () => {
    const key = 'John Doe_Jane Roe.jpg';
    const url = storageHelpers.publicUrl(key);
    expect(storageHelpers.keyFromPublicUrl(url)).toBe(key);
  });

  it('returns null for URLs outside our bucket (no foreign deletions)', () => {
    expect(storageHelpers.keyFromPublicUrl('https://evil.example.com/x.jpg')).toBeNull();
    expect(
      storageHelpers.keyFromPublicUrl(
        'https://test-project.supabase.co/storage/v1/object/public/other-bucket/x.jpg'
      )
    ).toBeNull();
  });
});

describe('listKeys pagination (TC-STOR-002, BVA at the 1000-item page cap)', () => {
  const page = (count: number, offset: number) =>
    Array.from({ length: count }, (_, i) => ({ name: `file-${offset + i}.jpg` }));

  it('returns a single short page', async () => {
    listMock.mockResolvedValueOnce({ data: page(3, 0), error: null });
    const keys = await storageHelpers.listKeys();
    expect(keys).toHaveLength(3);
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it('pages past a full 1000-item page and aggregates all keys', async () => {
    listMock
      .mockResolvedValueOnce({ data: page(1000, 0), error: null })
      .mockResolvedValueOnce({ data: page(500, 1000), error: null });

    const keys = await storageHelpers.listKeys();

    expect(keys).toHaveLength(1500);
    expect(listMock).toHaveBeenNthCalledWith(1, '', { limit: 1000, offset: 0 });
    expect(listMock).toHaveBeenNthCalledWith(2, '', { limit: 1000, offset: 1000 });
  });

  it('stops after an exactly-full final page followed by an empty page (boundary)', async () => {
    listMock
      .mockResolvedValueOnce({ data: page(1000, 0), error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const keys = await storageHelpers.listKeys();
    expect(keys).toHaveLength(1000);
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('returns [] for an empty bucket', async () => {
    listMock.mockResolvedValueOnce({ data: [], error: null });
    expect(await storageHelpers.listKeys()).toEqual([]);
  });

  it('throws a labeled error when the API errors', async () => {
    listMock.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    await expect(storageHelpers.listKeys()).rejects.toThrow('storage.list: boom');
  });
});

describe('upload/remove error propagation (TC-STOR-003)', () => {
  it('throws labeled errors so callers can distinguish the failing operation', async () => {
    uploadMock.mockResolvedValueOnce({ error: { message: 'quota' } });
    await expect(storageHelpers.upload('k.jpg', Buffer.from('x'), 'image/jpeg')).rejects.toThrow(
      'storage.upload: quota'
    );

    removeMock.mockResolvedValueOnce({ error: { message: 'denied' } });
    await expect(storageHelpers.remove('k.jpg')).rejects.toThrow('storage.remove: denied');
  });
});
