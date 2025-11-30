import { getNeo4jSession, s3Helpers } from '@/lib/db';

export interface ConnectionSegment {
  start: string;
  relationship: string;
  end: string;
  imageUrl: string | null;
}

export interface ConnectionPath {
  segments: ConnectionSegment[];
  imageUrls: (string | null)[];
}

/**
 * Connection Repository - handles all graph database operations for connections
 */
export class ConnectionRepository {
  /**
   * Find the shortest path between two people
   */
  async findShortestPath(name1: string, name2: string): Promise<ConnectionPath[]> {
    const session = getNeo4jSession();

    try {
      const result = await session.run(
        `
        MATCH path = shortestPath((u1:Person {name: $name1})-[*]-(u2:Person {name: $name2}))
        RETURN path
        `,
        { name1, name2 }
      );

      const connections = await Promise.all(
        result.records.map(async (record) => {
          const path = record.get('path');
          const segments: ConnectionSegment[] = path.segments.map(
            (segment: {
              start: { properties: { name: string } };
              relationship: { type: string; properties: { imageUrl: string } };
              end: { properties: { name: string } };
            }) => ({
              start: segment.start.properties.name,
              relationship: segment.relationship.type,
              end: segment.end.properties.name,
              imageUrl: segment.relationship.properties.imageUrl,
            })
          );

          const imageUrls = await Promise.all(
            segments.map(async (segment) => {
              if (segment.imageUrl) {
                const fileName = segment.imageUrl.split('/').pop();
                if (fileName) {
                  return s3Helpers.getPresignedUrl(fileName);
                }
              }
              return null;
            })
          );

          return { segments, imageUrls };
        })
      );

      return connections;
    } finally {
      await session.close();
    }
  }

  /**
   * Get connection between two people with image URL
   */
  async getConnectionWithImage(
    firstPerson: string,
    secondPerson: string
  ): Promise<{ imageUrl: string | null } | null> {
    const session = getNeo4jSession();

    try {
      const result = await session.run(
        `
        MATCH (p1:Person {name: $firstPersonName})-[r:PHOTOGRAPHED_WITH]->(p2:Person {name: $secondPersonName})
        RETURN r.imageUrl as imageUrl
        `,
        {
          firstPersonName: firstPerson,
          secondPersonName: secondPerson,
        }
      );

      if (result.records.length === 0) {
        return null;
      }

      return {
        imageUrl: result.records[0].get('imageUrl'),
      };
    } finally {
      await session.close();
    }
  }

  /**
   * Delete a connection between two people
   */
  async deleteConnection(firstPerson: string, secondPerson: string): Promise<void> {
    const session = getNeo4jSession();

    try {
      await session.run(
        `
        MATCH (p1:Person {name: $firstPersonName})-[r:PHOTOGRAPHED_WITH]->(p2:Person {name: $secondPersonName})
        DELETE r
        `,
        {
          firstPersonName: firstPerson,
          secondPersonName: secondPerson,
        }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Delete a person node
   */
  async deletePersonNode(name: string): Promise<boolean> {
    const session = getNeo4jSession();

    try {
      // First check if node has any remaining relationships
      const checkResult = await session.run(
        `
        MATCH (p:Person {name: $name})-[r]-()
        RETURN count(r) as relCount
        `,
        { name }
      );

      const relCount = checkResult.records[0]?.get('relCount')?.toNumber() || 0;

      if (relCount > 0) {
        return false; // Can't delete - has relationships
      }

      // Delete the node
      await session.run(
        `
        MATCH (p:Person {name: $name})
        DELETE p
        `,
        { name }
      );

      return true;
    } finally {
      await session.close();
    }
  }

  /**
   * Create a connection between two people
   */
  async createConnection(
    firstPerson: string,
    secondPerson: string,
    imageUrl: string
  ): Promise<void> {
    const session = getNeo4jSession();

    try {
      await session.run(
        `
        MERGE (p1:Person {name: $firstPerson})
        MERGE (p2:Person {name: $secondPerson})
        CREATE (p1)-[:PHOTOGRAPHED_WITH {imageUrl: $imageUrl}]->(p2)
        `,
        {
          firstPerson,
          secondPerson,
          imageUrl,
        }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * Check if a connection already exists between two people
   */
  async connectionExists(firstPerson: string, secondPerson: string): Promise<boolean> {
    const session = getNeo4jSession();

    try {
      const result = await session.run(
        `
        MATCH (p1:Person {name: $firstPerson})-[:PHOTOGRAPHED_WITH]-(p2:Person {name: $secondPerson})
        RETURN count(*) as count
        `,
        { firstPerson, secondPerson }
      );

      const count = result.records[0]?.get('count')?.toNumber() || 0;
      return count > 0;
    } finally {
      await session.close();
    }
  }
}

// Export singleton instance
export const connectionRepository = new ConnectionRepository();
