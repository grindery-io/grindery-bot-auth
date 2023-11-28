"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = tslib_1.__importDefault(require("express"));
const auth_1 = require("../utils/auth");
const constants_1 = require("../utils/constants");
const conn_1 = require("../db/conn");
const router = express_1.default.Router();
/**
 * GET /v1/transactions-last-hour
 *
 * @summary Get the number of transactions made in the last hour
 * @description Retrieves the count of transactions made in the last hour.
 * @tags Transactions
 * @return {object} 200 - Number of transactions made in the last hour.
 * @return {object} 500 - Error response.
 * @example response - 200 - Success response example
 * {
 *   "count": 50
 * }
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Server error description"
 * }
 */
router.get('/transactions-last-hour', auth_1.authenticateApiKey, async (_req, res) => {
    try {
        const db = await conn_1.Database.getInstance();
        return res.status(200).json({
            count: await db.collection(constants_1.TRANSFERS_COLLECTION).count({
                dateAdded: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
            }),
        });
    }
    catch (error) {
        return res.status(500).json({ msg: 'An error occurred', error });
    }
});
exports.default = router;
//# sourceMappingURL=analytics.js.map