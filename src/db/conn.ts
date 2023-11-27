import { Db, MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { TEST_ENV, getAtlasUri } from '../../secrets';

export class Database {
  static instance: Db;

  static async getInstance() {
    if (!Database.instance) {
      if (!TEST_ENV) {
        const client = new MongoClient(await getAtlasUri());
        let conn: MongoClient;
        try {
          conn = await client.connect();
        } catch (e) {
          console.error(e);
        }

        Database.instance = conn.db('grindery-bot');
      } else {
        // This will create an new instance of "MongoMemoryServer" and automatically start it
        const mongod = await MongoMemoryServer.create();
        const clientMemory = new MongoClient(mongod.getUri());
        const connMemory = await clientMemory.connect();

        Database.instance = connMemory.db('grindery-test-server');
      }
    }
    return Database.instance;
  }
}
