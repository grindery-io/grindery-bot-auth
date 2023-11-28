"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Database = void 0;
const mongodb_1 = require("mongodb");
const mongodb_memory_server_1 = require("mongodb-memory-server");
const secrets_1 = require("../../secrets");
class Database {
    static instance;
    static async getInstance() {
        if (!Database.instance) {
            if (!secrets_1.TEST_ENV) {
                const client = new mongodb_1.MongoClient(await (0, secrets_1.getAtlasUri)());
                let conn;
                try {
                    conn = await client.connect();
                }
                catch (e) {
                    console.error(e);
                }
                Database.instance = conn.db('grindery-bot');
            }
            else {
                // This will create an new instance of "MongoMemoryServer" and automatically start it
                const mongod = await mongodb_memory_server_1.MongoMemoryServer.create();
                const clientMemory = new mongodb_1.MongoClient(mongod.getUri());
                const connMemory = await clientMemory.connect();
                Database.instance = connMemory.db('grindery-test-server');
            }
        }
        return Database.instance;
    }
}
exports.Database = Database;
//# sourceMappingURL=conn.js.map