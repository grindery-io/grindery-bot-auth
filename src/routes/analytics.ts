import express from 'express';
import { authenticateApiKey } from '../utils/auth';
import { TRANSFERS_COLLECTION } from '../utils/constants';
import { Database } from '../db/conn';
import { getLastHourDateTime } from '../utils/time';

const router = express.Router();

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
router.get('/transactions-last-hour', authenticateApiKey, async (_req, res) => {
  try {
    return res.status(200).json({
      count: await (await Database.getInstance())
        .collection(TRANSFERS_COLLECTION)
        .count({
          dateAdded: { $gte: getLastHourDateTime() },
        }),
    });
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

export default router;
