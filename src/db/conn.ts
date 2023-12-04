import { Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PRODUCTION_ENV, getAtlasUri } from '../../secrets';

export class Database {
  /** Represents the instance of the database. */
  static instance: Db;

  /**
   * Retrieves or creates an instance of the database.
   * If in production, connects to the actual MongoDB Atlas instance,
   * else utilizes a temporary in-memory MongoDB server.
   * @returns {Promise<Db>} An instance of the database.
   */
  static async getInstance(): Promise<Db> {
    // Check if an instance already exists
    if (!Database.instance) {
      // In production environment
      if (PRODUCTION_ENV) {
        // Create a MongoDB client using the Atlas URI
        const client = new MongoClient(await getAtlasUri());
        let conn: MongoClient;

        try {
          // Connect to the MongoDB Atlas instance
          conn = await client.connect();
        } catch (e) {
          console.error(e);
        }

        // Set the database instance
        Database.instance = conn.db('grindery-bot');
      } else {
        // For local environment (testing)
        // This will create a new instance of "MongoMemoryServer" and automatically start it
        const mongod = await MongoMemoryServer.create();
        const clientMemory = new MongoClient(mongod.getUri());
        const connMemory = await clientMemory.connect();

        // Set the database instance for local environment
        Database.instance = connMemory.db('grindery-test-server');
      }
    }
    // Return the database instance
    return Database.instance;
  }
}
