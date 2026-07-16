/**
 * TC-SUGG — suggestion & popular-names service (traces: R4, R5).
 * Techniques: equivalence partitioning on query classes, boundary-value
 * analysis on the 0.5 similarity threshold and the 5-minute popular cache.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/repositories', () => ({
  suggestionRepository: {
    getAllNames: vi.fn(),
    invalidateCache: vi.fn(),
  },
  connectionRepository: {
    getTopPeopleByDegree: vi.fn(),
  },
}));

import { suggestionService } from '@/lib/services/suggestionService';
import { suggestionRepository, connectionRepository } from '@/lib/repositories';

const getAllNames = vi.mocked(suggestionRepository.getAllNames);
const getTopPeopleByDegree = vi.mocked(connectionRepository.getTopPeopleByDegree);

beforeEach(() => {
  vi.clearAllMocks();
  suggestionService.invalidateCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getSuggestions (TC-SUGG-001)', () => {
  it('returns [] for an empty query without filtering', async () => {
    getAllNames.mockResolvedValue(['John Doe']);
    expect(await suggestionService.getSuggestions('')).toEqual([]);
  });

  it('matches case-insensitive substrings', async () => {
    getAllNames.mockResolvedValue(['John Doe', 'Jane Roe', 'Travis Scott']);
    expect(await suggestionService.getSuggestions('doe')).toEqual(['John Doe']);
    expect(await suggestionService.getSuggestions('JOHN')).toEqual(['John Doe']);
  });

  it('tolerates a one-character typo via Levenshtein similarity', async () => {
    getAllNames.mockResolvedValue(['John Doe']);
    // "Jhn Doe" vs "john doe": distance 1, length 8 → similarity 0.875 ≥ 0.5
    expect(await suggestionService.getSuggestions('Jhn Doe')).toEqual(['John Doe']);
  });

  it('similarity threshold boundary: distance/length = 0.5 included, beyond excluded (TC-SUGG-002)', async () => {
    getAllNames.mockResolvedValue(['abcd']);
    // distance("abxy","abcd") = 2 → similarity exactly 0.5 → included
    expect(await suggestionService.getSuggestions('abxy')).toEqual(['abcd']);
    // distance("axyz","abcd") = 3 → similarity 0.25 → excluded
    expect(await suggestionService.getSuggestions('axyz')).toEqual([]);
  });

  it('returns [] when the name pool is empty', async () => {
    getAllNames.mockResolvedValue([]);
    expect(await suggestionService.getSuggestions('anything')).toEqual([]);
  });
});

describe('getPopularNames cache (TC-SUGG-003, state transition: cold → warm → expired → invalidated)', () => {
  it('fetches at least 12 names on a cold cache and slices to the requested limit', async () => {
    getTopPeopleByDegree.mockResolvedValue(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
    const names = await suggestionService.getPopularNames(3);
    expect(names).toEqual(['a', 'b', 'c']);
    expect(getTopPeopleByDegree).toHaveBeenCalledWith(12);
  });

  it('serves warm-cache reads without re-querying', async () => {
    vi.useFakeTimers();
    getTopPeopleByDegree.mockResolvedValue(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
    await suggestionService.getPopularNames(5);
    vi.advanceTimersByTime(4 * 60_000); // still inside the 5-minute window
    await suggestionService.getPopularNames(5);
    expect(getTopPeopleByDegree).toHaveBeenCalledTimes(1);
  });

  it('re-queries once the 5-minute window elapses (boundary)', async () => {
    vi.useFakeTimers();
    getTopPeopleByDegree.mockResolvedValue(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
    await suggestionService.getPopularNames(5);
    vi.advanceTimersByTime(5 * 60_000); // exactly at expiry — cache no longer fresh
    await suggestionService.getPopularNames(5);
    expect(getTopPeopleByDegree).toHaveBeenCalledTimes(2);
  });

  it('re-queries when a larger limit than cached is requested', async () => {
    getTopPeopleByDegree.mockResolvedValue(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
    await suggestionService.getPopularNames(5);
    await suggestionService.getPopularNames(20); // cache only holds 12
    expect(getTopPeopleByDegree).toHaveBeenCalledTimes(2);
    expect(getTopPeopleByDegree).toHaveBeenLastCalledWith(20);
  });

  it('invalidateCache clears both the popular cache and the repository cache', async () => {
    getTopPeopleByDegree.mockResolvedValue(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']);
    await suggestionService.getPopularNames(5);
    suggestionService.invalidateCache();
    await suggestionService.getPopularNames(5);
    expect(getTopPeopleByDegree).toHaveBeenCalledTimes(2);
    expect(suggestionRepository.invalidateCache).toHaveBeenCalled();
  });
});
