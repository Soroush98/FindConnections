import neo4j, { Driver, Session } from 'neo4j-driver';
import { neo4jConfig } from '@/lib/env';

/**
 * Neo4j driver singleton
 * Ensures a single connection pool is reused across the application
 */
class Neo4jDriverSingleton {
  private static instance: Driver | null = null;

  static getInstance(): Driver {
    if (!this.instance) {
      this.instance = neo4j.driver(
        neo4jConfig.uri,
        neo4j.auth.basic(neo4jConfig.user, neo4jConfig.password),
        {
          maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
          maxConnectionPoolSize: 50,
          connectionAcquisitionTimeout: 2 * 60 * 1000, // 2 minutes
        }
      );
    }

    return this.instance;
  }

  /**
   * Get a session for executing queries
   * Remember to close the session after use
   */
  static getSession(): Session {
    return this.getInstance().session();
  }

  /**
   * Close the driver connection
   * Call this when shutting down the application
   */
  static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.close();
      this.instance = null;
    }
  }
}

export const neo4jDriver = Neo4jDriverSingleton.getInstance();
export const getNeo4jSession = () => Neo4jDriverSingleton.getSession();
export const closeNeo4j = () => Neo4jDriverSingleton.close();
