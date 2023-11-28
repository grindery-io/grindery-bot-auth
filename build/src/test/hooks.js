"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mochaHooks = void 0;
const conn_1 = require("../db/conn");
exports.mochaHooks = {
    afterEach: async function () {
        const db = await conn_1.Database.getInstance();
        if (db.namespace === 'grindery-test-server') {
            await db.dropDatabase();
        }
    },
};
//# sourceMappingURL=hooks.js.map