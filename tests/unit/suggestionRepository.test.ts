/**
 * TC-SUGGREPO — name derivation from storage keys (traces: R2, R4).
 * The suggestion pool is PARSED out of object keys shaped
 * `First Last_First Last.ext` — this parsing is the seam that breaks when
 * the key convention drifts (see TC-DATA-007 for the live check).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/db/storage', () => ({
  storageHelpers: { listKeys: vi.fn() },
}));

import { suggestionRepository } from '@/lib/repositories/suggestionRepository';
import { storageHelpers } from '@/lib/db/storage';

const listKeys = vi.mocked(storageHelpers.listKeys);

beforeEach(() => {
  vi.clearAllMocks();
  suggestionRepository.invalidateCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fetchNamesFromStorage (TC-SUGGREPO-001)', () => {
  it('derives both names from a conventional key and dedupes across keys', async () => {
    listKeys.mockResolvedValue([
      'John Doe_Jane Roe.jpg',
      'Jane Roe_Travis Scott.png',
    ]);
    const names = await suggestionRepository.getAllNames();
    expect(names.sort()).toEqual(['Jane Roe', 'John Doe', 'Travis Scott']);
  });

  it('strips directory prefixes and file extensions', async () => {
    listKeys.mockResolvedValue(['some/prefix/John Doe_Jane Roe.jpeg']);
    const names = await suggestionRepository.getAllNames();
    expect(names.sort()).toEqual(['Jane Roe', 'John Doe']);
  });

  it('tolerates malformed keys without crashing (missing underscore)', async () => {
    listKeys.mockResolvedValue(['README.txt', 'John Doe_Jane Roe.jpg']);
    const names = await suggestionRepository.getAllNames();
    // 'README.txt' contributes a junk first token — parser keeps it (documents
    // why TC-DATA-007 polices the bucket convention).
    expect(names).toContain('John Doe');
    expect(names).toContain('Jane Roe');
  });

  it('returns [] (not a throw) when storage listing fails — suggestions degrade gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    listKeys.mockRejectedValue(new Error('storage down'));
    expect(await suggestionRepository.getAllNames()).toEqual([]);
    consoleSpy.mockRestore();
  });
});

describe('cache behavior (TC-SUGGREPO-002, 60s window)', () => {
  it('serves from cache within 60s, refetches after, and honors invalidateCache', async () => {
    vi.useFakeTimers();
    listKeys.mockResolvedValue(['John Doe_Jane Roe.jpg']);

    await suggestionRepository.getAllNames();
    vi.advanceTimersByTime(59_000);
    await suggestionRepository.getAllNames();
    expect(listKeys).toHaveBeenCalledTimes(1); // warm

    vi.advanceTimersByTime(2_000); // past the 60s window
    await suggestionRepository.getAllNames();
    expect(listKeys).toHaveBeenCalledTimes(2); // expired → refetch

    suggestionRepository.invalidateCache();
    await suggestionRepository.getAllNames();
    expect(listKeys).toHaveBeenCalledTimes(3); // invalidated → refetch
  });

  it('does not cache an empty result permanently (empty list is re-queried)', async () => {
    listKeys.mockResolvedValue([]);
    await suggestionRepository.getAllNames();
    await suggestionRepository.getAllNames();
    // cachedNames.length is 0 → cache treated as cold → refetch each call.
    expect(listKeys).toHaveBeenCalledTimes(2);
  });
});
