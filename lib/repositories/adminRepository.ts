import { ScanCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDb } from '@/lib/db';

const TABLE_NAME = 'FL_Admin';

export interface AdminInfo {
  Id: string;
  Email: string;
  Password: string;
}

/**
 * Admin Repository - handles all admin-related database operations
 */
export class AdminRepository {
  /**
   * Find an admin by email
   */
  async findByEmail(email: string): Promise<AdminInfo | null> {
    const command = new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'Email = :email',
      ExpressionAttributeValues: { ':email': email },
    });

    const result = await dynamoDb.send(command);
    return (result.Items?.[0] as AdminInfo) || null;
  }

  /**
   * Find an admin by ID
   */
  async findById(id: string): Promise<AdminInfo | null> {
    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: { Id: id },
    });

    const result = await dynamoDb.send(command);
    return result.Item as AdminInfo | null;
  }
}

// Export singleton instance
export const adminRepository = new AdminRepository();
