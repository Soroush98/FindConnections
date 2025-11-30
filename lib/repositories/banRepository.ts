import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb } from '@/lib/db';

const TABLE_NAME = 'FL_BannedIPs';

export interface BanStatus {
  ip: string;
  attempts?: number;
  lastAttempt?: number;
  bannedUntil?: number;
  bannedEmail?: string;
}

const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const BAN_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Ban Repository - handles IP ban tracking for rate limiting
 */
export class BanRepository {
  /**
   * Get ban status for an IP address
   */
  async getBanStatus(ip: string): Promise<BanStatus | null> {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { ip },
    });

    const result = await dynamoDb.send(command);
    return result.Item as BanStatus | null;
  }

  /**
   * Check if an IP is currently banned
   */
  async isIpBanned(ip: string): Promise<{ banned: boolean; expiresAt?: number }> {
    const status = await this.getBanStatus(ip);

    if (status?.bannedUntil && status.bannedUntil > Date.now()) {
      return { banned: true, expiresAt: status.bannedUntil };
    }

    return { banned: false };
  }

  /**
   * Increment login attempts for an IP
   * Returns the new attempt count
   */
  async incrementAttempts(ip: string): Promise<number> {
    // Get current status
    const status = await this.getBanStatus(ip);
    let currentAttempts = status?.attempts || 0;
    const lastAttempt = status?.lastAttempt || 0;
    const now = Date.now();

    // Reset if more than ATTEMPT_WINDOW has passed
    if (now - lastAttempt > ATTEMPT_WINDOW) {
      currentAttempts = 0;
    }

    const newAttempts = currentAttempts + 1;

    // Update in database
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { ip },
      UpdateExpression: 'SET attempts = :a, lastAttempt = :t',
      ExpressionAttributeValues: {
        ':a': newAttempts,
        ':t': now,
      },
      ReturnValues: 'UPDATED_NEW',
    });

    await dynamoDb.send(command);
    return newAttempts;
  }

  /**
   * Ban an IP address
   */
  async banIp(ip: string, userEmail: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { ip },
      UpdateExpression: 'SET bannedUntil = :until, bannedEmail = :email',
      ExpressionAttributeValues: {
        ':until': Date.now() + BAN_DURATION,
        ':email': userEmail,
      },
    });

    await dynamoDb.send(command);
  }

  /**
   * Reset ban status for an IP (on successful login)
   */
  async resetBan(ip: string): Promise<void> {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { ip },
      UpdateExpression: 'REMOVE bannedUntil, bannedEmail SET attempts = :start, lastAttempt = :now',
      ExpressionAttributeValues: {
        ':start': 0,
        ':now': Date.now(),
      },
    });

    await dynamoDb.send(command);
  }

  /**
   * Check if attempts have exceeded the limit
   */
  hasExceededLimit(attempts: number): boolean {
    return attempts >= MAX_ATTEMPTS;
  }

  /**
   * Get configuration constants
   */
  getConfig() {
    return {
      maxAttempts: MAX_ATTEMPTS,
      attemptWindow: ATTEMPT_WINDOW,
      banDuration: BAN_DURATION,
    };
  }
}

// Export singleton instance
export const banRepository = new BanRepository();
