import { ListObjectsV2Command, s3Client } from '@/lib/db';
import { awsConfig } from '@/lib/env';

/**
 * Suggestion Repository - handles S3 operations for name suggestions
 */
export class SuggestionRepository {
  private cachedNames: string[] = [];
  private cacheTimestamp = 0;
  private readonly cacheDurationMs = 60000; // 60 seconds

  /**
   * Fetch all unique names from S3 bucket
   */
  async fetchNamesFromS3(): Promise<string[]> {
    try {
      console.log('Fetching names from S3');
      const command = new ListObjectsV2Command({ Bucket: awsConfig.bucketName });
      const response = await s3Client.send(command);
      const keys = response.Contents?.map((obj) => obj.Key) || [];
      const namesSet = new Set<string>();

      keys.forEach((key) => {
        // Expect keys like "Firstfullname_Secondfullname.extension"
        if (typeof key === 'string') {
          const baseName = key.split('/').pop() || ''; // if keys include folders
          const [name1, rest] = baseName.split('_');
          if (name1) {
            namesSet.add(name1.trim());
          }
          if (rest) {
            const name2 = rest.split('.')[0]; // remove extension
            namesSet.add(name2.trim());
          }
        }
      });

      return Array.from(namesSet);
    } catch (error) {
      console.error('Error fetching from S3', error);
      return [];
    }
  }

  /**
   * Get all names with caching
   */
  async getAllNames(): Promise<string[]> {
    const now = Date.now();

    if (this.cachedNames.length && now - this.cacheTimestamp < this.cacheDurationMs) {
      return this.cachedNames;
    }

    const names = await this.fetchNamesFromS3();
    this.cachedNames = names;
    this.cacheTimestamp = now;

    return names;
  }

  /**
   * Invalidate the cache (useful after uploads)
   */
  invalidateCache(): void {
    this.cachedNames = [];
    this.cacheTimestamp = 0;
  }
}

// Export singleton instance
export const suggestionRepository = new SuggestionRepository();
