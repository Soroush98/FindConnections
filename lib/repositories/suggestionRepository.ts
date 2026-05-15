import { storageHelpers } from '@/lib/db/storage';

/**
 * Suggestion Repository — derives the unique celebrity-name set from object
 * keys in the connection-images Storage bucket. Object names follow the
 * convention `FirstFullName_SecondFullName.ext`.
 */
export class SuggestionRepository {
  private cachedNames: string[] = [];
  private cacheTimestamp = 0;
  private readonly cacheDurationMs = 60_000;

  async fetchNamesFromStorage(): Promise<string[]> {
    try {
      const keys = await storageHelpers.listKeys();
      const namesSet = new Set<string>();
      for (const key of keys) {
        const baseName = key.split('/').pop() || '';
        const [first, rest] = baseName.split('_');
        if (first) namesSet.add(first.trim());
        if (rest) {
          const second = rest.split('.')[0];
          namesSet.add(second.trim());
        }
      }
      return Array.from(namesSet);
    } catch (error) {
      console.error('Error listing Storage objects:', error);
      return [];
    }
  }

  async getAllNames(): Promise<string[]> {
    const now = Date.now();
    if (this.cachedNames.length && now - this.cacheTimestamp < this.cacheDurationMs) {
      return this.cachedNames;
    }
    const names = await this.fetchNamesFromStorage();
    this.cachedNames = names;
    this.cacheTimestamp = now;
    return names;
  }

  invalidateCache(): void {
    this.cachedNames = [];
    this.cacheTimestamp = 0;
  }
}

export const suggestionRepository = new SuggestionRepository();
