import { connectionRepository, ConnectionPath } from '@/lib/repositories';
import { storageHelpers } from '@/lib/db/storage';
import { AppError } from '@/lib/errors';

/**
 * Connection Service - handles connection business logic
 */
export class ConnectionService {
  /**
   * Find connections between two people
   */
  async findConnections(name1: string, name2: string): Promise<ConnectionPath[]> {
    if (!name1 || !name2) {
      throw AppError.missingFields(['name1', 'name2']);
    }

    return connectionRepository.findShortestPath(name1, name2);
  }

  /**
   * Delete a connection between two people (admin only)
   */
  async deleteConnection(firstPerson: string, secondPerson: string): Promise<void> {
    if (!firstPerson || !secondPerson) {
      throw AppError.missingFields(['firstPersonFullName', 'secondPersonFullName']);
    }

    // Get the connection to find the image URL
    const connection = await connectionRepository.getConnectionWithImage(firstPerson, secondPerson);
    if (!connection) {
      throw AppError.notFound('Connection');
    }

    // Delete the connection from Neo4j
    await connectionRepository.deleteConnection(firstPerson, secondPerson);

    // Delete the image from Supabase Storage if it exists
    if (connection.imageUrl) {
      const key = storageHelpers.keyFromPublicUrl(connection.imageUrl);
      if (key) {
        try {
          await storageHelpers.remove(key);
        } catch (error) {
          console.error('Error deleting Storage object:', error);
          // Continue even if Storage deletion fails
        }
      }
    }
  }

  /**
   * Delete a person node (admin only)
   */
  async deletePersonNode(name: string): Promise<void> {
    if (!name) {
      throw AppError.missingFields(['name']);
    }

    const deleted = await connectionRepository.deletePersonNode(name);
    if (!deleted) {
      throw AppError.conflict('Cannot delete person with existing relationships');
    }
  }

  /**
   * Create a new connection
   */
  async createConnection(
    firstPerson: string,
    secondPerson: string,
    imageUrl: string
  ): Promise<void> {
    if (!firstPerson || !secondPerson || !imageUrl) {
      throw AppError.missingFields(['firstPerson', 'secondPerson', 'imageUrl']);
    }

    // Check if connection already exists
    const exists = await connectionRepository.connectionExists(firstPerson, secondPerson);
    if (exists) {
      throw AppError.alreadyExists('Connection');
    }

    await connectionRepository.createConnection(firstPerson, secondPerson, imageUrl);
  }

  /**
   * Check if a connection exists
   */
  async connectionExists(firstPerson: string, secondPerson: string): Promise<boolean> {
    return connectionRepository.connectionExists(firstPerson, secondPerson);
  }
}

// Export singleton instance
export const connectionService = new ConnectionService();
