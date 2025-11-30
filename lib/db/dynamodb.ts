import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { awsConfig } from '@/lib/env';

/**
 * DynamoDB client singleton
 * Ensures a single connection is reused across the application
 */
class DynamoDBClientSingleton {
  private static instance: DynamoDBDocumentClient | null = null;
  private static baseClient: DynamoDBClient | null = null;

  static getInstance(): DynamoDBDocumentClient {
    if (!this.instance) {
      this.baseClient = new DynamoDBClient({
        region: awsConfig.region,
        credentials: {
          accessKeyId: awsConfig.accessKeyId,
          secretAccessKey: awsConfig.secretAccessKey,
        },
      });

      this.instance = DynamoDBDocumentClient.from(this.baseClient, {
        marshallOptions: {
          convertEmptyValues: true,
          removeUndefinedValues: true,
        },
      });
    }

    return this.instance;
  }

  static getBaseClient(): DynamoDBClient {
    if (!this.baseClient) {
      this.getInstance(); // This will initialize both clients
    }
    return this.baseClient!;
  }
}

export const dynamoDb = DynamoDBClientSingleton.getInstance();
export const dynamoDbBase = DynamoDBClientSingleton.getBaseClient();
