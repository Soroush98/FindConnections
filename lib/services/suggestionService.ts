import { suggestionRepository } from '@/lib/repositories';

/**
 * Helper function to compute Levenshtein distance
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  const aLen = a.length;
  const bLen = b.length;

  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  for (let i = 0; i <= bLen; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= aLen; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLen; i++) {
    for (let j = 1; j <= aLen; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }

  return matrix[bLen][aLen];
}

/**
 * Suggestion Service - handles name suggestion business logic
 */
export class SuggestionService {
  /**
   * Get name suggestions based on a query
   */
  async getSuggestions(query: string): Promise<string[]> {
    const allNames = await suggestionRepository.getAllNames();

    if (!query) {
      return [];
    }

    const lowerQuery = query.toLowerCase();

    const suggestions = allNames.filter((name) => {
      const lowerName = name.toLowerCase();

      // Direct substring match
      if (lowerName.includes(lowerQuery)) return true;

      // Calculate similarity using normalized Levenshtein distance
      const distance = levenshtein(lowerQuery, lowerName);
      const similarity = 1 - distance / lowerName.length;

      return similarity >= 0.5;
    });

    return suggestions;
  }

  /**
   * Check if a file already exists in temp bucket
   */
  async fileExistsInTemp(
    firstPerson: string,
    secondPerson: string,
    fileExtension: string
  ): Promise<boolean> {
    return suggestionRepository.checkTempFileExists(firstPerson, secondPerson, fileExtension);
  }

  /**
   * Upload a file to temp bucket
   */
  async uploadToTemp(
    firstPerson: string,
    secondPerson: string,
    fileExtension: string,
    buffer: Buffer,
    contentType: string
  ): Promise<string> {
    return suggestionRepository.uploadToTempBucket(
      firstPerson,
      secondPerson,
      fileExtension,
      buffer,
      contentType
    );
  }

  /**
   * Invalidate the name cache
   */
  invalidateCache(): void {
    suggestionRepository.invalidateCache();
  }
}

// Export singleton instance
export const suggestionService = new SuggestionService();
