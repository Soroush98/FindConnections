import { NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { awsConfig } from '../../../../config'; // assume credentials are exported from here

// In-memory cache variables
let cachedNames: string[] = [];
let cacheTimestamp = 0;
const CACHE_DURATION_MS = 60000; // cache names for 60 seconds

// Initialize S3 client
const s3 = new S3Client({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
});

const bucketName = awsConfig.bucketName;

// Helper function to compute Levenshtein distance
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
          matrix[i - 1][j] + 1,   // deletion
          matrix[i][j - 1] + 1,   // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return matrix[bLen][aLen];
}

async function fetchNamesFromS3(): Promise<string[]> {
  try {
    console.log("Fetching names from S3");
    const command = new ListObjectsV2Command({ Bucket: bucketName });
    const response = await s3.send(command);
    const keys = response.Contents?.map(obj => obj.Key) || [];
    const namesSet = new Set<string>();

    keys.forEach(key => {
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

export async function GET(request: Request) {
  const now = Date.now();
  let storedNames: string[] = [];
  if (cachedNames.length && (now - cacheTimestamp < CACHE_DURATION_MS)) {
    storedNames = cachedNames;
  } else {
    storedNames = await fetchNamesFromS3();
    cachedNames = storedNames;
    cacheTimestamp = now;
  }
  
  const url = new URL(request.url);
  const query = url.searchParams.get("query") || "";
  const lowerQuery = query.toLowerCase();

  const suggestions = storedNames.filter(name => {
    const lowerName = name.toLowerCase();
    // Direct substring match
    if (lowerName.includes(lowerQuery)) return true;
    // Calculate similarity using normalized Levenshtein distance
    const distance = levenshtein(lowerQuery, lowerName);
    const similarity = 1 - distance / lowerName.length;
    return similarity >= 0.5;
  });

  // Return the response with client caching headers
  return NextResponse.json(
    { suggestions },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" } }
  );
}
