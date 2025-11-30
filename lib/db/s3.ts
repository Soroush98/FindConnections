import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { awsConfig } from '@/lib/env';

/**
 * S3 client singleton
 * Ensures a single client is reused across the application
 */
class S3ClientSingleton {
  private static instance: S3Client | null = null;

  static getInstance(): S3Client {
    if (!this.instance) {
      this.instance = new S3Client({
        region: awsConfig.region,
        credentials: {
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
        },
      });
    }

    return this.instance;
  }
}

export const s3Client = S3ClientSingleton.getInstance();

/**
 * S3 helper functions
 */
export const s3Helpers = {
  /**
   * Get a presigned URL for an object
   */
  async getPresignedUrl(key: string, expiresIn = 60): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: awsConfig.bucketName,
      Key: key,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
  },

  /**
   * Upload an object to S3
   */
  async putObject(key: string, body: Buffer, contentType: string, bucket?: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucket || awsConfig.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await s3Client.send(command);
  },

  /**
   * Delete an object from S3
   */
  async deleteObject(key: string, bucket?: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket || awsConfig.bucketName,
      Key: key,
    });
    await s3Client.send(command);
  },

  /**
   * List objects in a bucket
   */
  async listObjects(prefix = '', bucket?: string) {
    const command = new ListObjectsV2Command({
      Bucket: bucket || awsConfig.bucketName,
      Prefix: prefix,
    });
    return s3Client.send(command);
  },

  /**
   * Check if a file exists in S3
   */
  async fileExists(key: string, bucket?: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket || awsConfig.bucketName,
        Key: key,
      });
      await s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  },
};

// Re-export commands for direct use if needed
export { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command };
