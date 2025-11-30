import { GetCommand, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { PutItemCommand, ScanCommand as BaseScanCommand } from '@aws-sdk/client-dynamodb';
import { dynamoDb, dynamoDbBase } from '@/lib/db';
import { UserInfo } from '@/types/UserInfo';

const TABLE_NAME = 'FL_Users';

export interface CreateUserInput {
  name: string;
  familyName: string;
  email: string;
  hashedPassword: string;
  confirmationToken: string;
  tokenExpiration: number;
}

export interface UpdateUserPasswordInput {
  userId: string;
  hashedPassword: string;
}

export interface UpdateUploadCountInput {
  userId: string;
  newCount: number;
  date: string;
}

/**
 * User Repository - handles all user-related database operations
 */
export class UserRepository {
  /**
   * Find a user by ID
   */
  async findById(id: string): Promise<UserInfo | null> {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { Id: id },
    });

    const result = await dynamoDb.send(command);
    return result.Item as UserInfo | null;
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<UserInfo | null> {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'Email = :email',
      ExpressionAttributeValues: { ':email': email },
    });

    const result = await dynamoDb.send(command);
    return (result.Items?.[0] as UserInfo) || null;
  }

  /**
   * Find a user by confirmation token
   */
  async findByConfirmationToken(token: string): Promise<UserInfo | null> {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'confirmationToken = :token',
      ExpressionAttributeValues: { ':token': token },
    });

    const result = await dynamoDb.send(command);
    return (result.Items?.[0] as UserInfo) || null;
  }

  /**
   * Find a user by reset token
   */
  async findByResetToken(token: string): Promise<UserInfo | null> {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'resetToken = :token',
      ExpressionAttributeValues: { ':token': token },
    });

    const result = await dynamoDb.send(command);
    return (result.Items?.[0] as UserInfo) || null;
  }

  /**
   * Check if email exists
   */
  async emailExists(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return !!user;
  }

  /**
   * Get the next available user ID
   */
  async getNextId(): Promise<string> {
    const command = new BaseScanCommand({
      TableName: TABLE_NAME,
      ProjectionExpression: 'Id',
    });

    const result = await dynamoDbBase.send(command);
    const items = result.Items || [];
    const maxId = items.length > 0
      ? Math.max(...items.map(item => item.Id?.S ? parseInt(item.Id.S) : 0))
      : 0;

    return (maxId + 1).toString();
  }

  /**
   * Create a new user
   */
  async create(input: CreateUserInput): Promise<string> {
    const id = await this.getNextId();

    const command = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        Id: { S: id },
        Name: { S: input.name },
        FamilyName: { S: input.familyName },
        Email: { S: input.email },
        Password: { S: input.hashedPassword },
        confirmationToken: { S: input.confirmationToken },
        tokenExpiration: { N: input.tokenExpiration.toString() },
        isConfirmed: { BOOL: false },
        uploadCount: { N: '0' },
        lastUploadDate: { S: ' ' },
        notification_enabled: { N: '0' },
      },
    });

    await dynamoDbBase.send(command);
    return id;
  }

  /**
   * Update user password
   */
  async updatePassword(userId: string, hashedPassword: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { Id: userId },
      UpdateExpression: 'SET Password = :password',
      ExpressionAttributeValues: { ':password': hashedPassword },
    });

    await dynamoDb.send(command);
  }

  /**
   * Confirm user email
   */
  async confirmEmail(userId: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { Id: userId },
      UpdateExpression: 'SET isConfirmed = :confirmed REMOVE confirmationToken, tokenExpiration',
      ExpressionAttributeValues: { ':confirmed': true },
    });

    await dynamoDb.send(command);
  }

  /**
   * Store reset token for password reset
   */
  async storeResetToken(userId: string, token: string, expiration: number): Promise<void> {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { Id: userId },
      UpdateExpression: 'SET resetToken = :token, resetTokenExpiration = :expiration',
      ExpressionAttributeValues: {
        ':token': token,
        ':expiration': expiration,
      },
    });

    await dynamoDb.send(command);
  }

  /**
   * Clear reset token after password reset
   */
  async clearResetToken(userId: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { Id: userId },
      UpdateExpression: 'REMOVE resetToken, resetTokenExpiration',
    });

    await dynamoDb.send(command);
  }

  /**
   * Update upload count with conditional check to prevent race conditions
   */
  async updateUploadCount(input: UpdateUploadCountInput): Promise<UserInfo | null> {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { Id: input.userId },
      UpdateExpression: 'SET uploadCount = :newCount, lastUploadDate = :date',
      ConditionExpression: '(uploadCount > :zero OR :today <> lastUploadDate)',
      ExpressionAttributeValues: {
        ':newCount': input.newCount,
        ':date': input.date,
        ':zero': 0,
        ':today': input.date,
      },
      ReturnValues: 'ALL_NEW',
    });

    const result = await dynamoDb.send(command);
    return result.Attributes as UserInfo | null;
  }

  /**
   * Update notification preference
   */
  async updateNotificationPreference(userId: string, enabled: boolean): Promise<void> {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { Id: userId },
      UpdateExpression: 'SET notification_enabled = :enabled',
      ExpressionAttributeValues: { ':enabled': enabled ? 1 : 0 },
    });

    await dynamoDb.send(command);
  }

  /**
   * Store new confirmation token
   */
  async storeConfirmationToken(userId: string, token: string, expiration: number): Promise<void> {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { Id: userId },
      UpdateExpression: 'SET confirmationToken = :token, tokenExpiration = :expiration',
      ExpressionAttributeValues: {
        ':token': token,
        ':expiration': expiration,
      },
    });

    await dynamoDb.send(command);
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
