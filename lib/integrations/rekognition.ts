import { RekognitionClient, RecognizeCelebritiesCommand } from '@aws-sdk/client-rekognition';
import { awsConfig } from '@/lib/env';

let client: RekognitionClient | null = null;

function getClient(): RekognitionClient {
  if (!client) {
    client = new RekognitionClient({
      region: awsConfig.region,
      credentials: {
        accessKeyId: awsConfig.accessKeyId,
        secretAccessKey: awsConfig.secretAccessKey,
      },
    });
  }
  return client;
}

export interface DetectedCelebrity {
  name: string;
  /** 0-100, Rekognition's confidence in the celebrity match */
  matchConfidence: number;
  /** 0-100, confidence that the detected region is a face */
  faceConfidence: number;
}

/**
 * Run AWS Rekognition RecognizeCelebrities against image bytes.
 * Returns one entry per recognized celebrity face (unrecognized faces are dropped).
 */
export async function recognizeCelebrities(imageBytes: Buffer): Promise<DetectedCelebrity[]> {
  const result = await getClient().send(
    new RecognizeCelebritiesCommand({ Image: { Bytes: imageBytes } })
  );

  return (result.CelebrityFaces || [])
    .filter((c) => c.Name)
    .map((c) => ({
      name: c.Name!,
      matchConfidence: c.MatchConfidence ?? 0,
      faceConfidence: c.Face?.Confidence ?? 0,
    }));
}
