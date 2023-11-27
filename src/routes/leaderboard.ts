import express from 'express';
import { Database } from '../db/conn';
import { authenticateApiKey } from '../utils/auth';
import { REWARDS_COLLECTION, TRANSFERS_COLLECTION } from '../utils/constants';

const router = express.Router();

/**
 * GET /v1/tx-sent
 *
 * @summary Get leaderboard for transactions sent
 * @description Retrieves a leaderboard showing users who have sent the most transactions.
 * @tags Leaderboard
 * @param {string} [request.query.days] - The number of past days to filter results by.
 * @param {string} [request.query.topX] - Limit results to the top X users.
 * @param {string} [request.query.limit=10] - Number of results per page.
 * @param {string} [request.query.skip=0] - Number of results to skip for pagination.
 * @return {object} 200 - Array of users and their transaction counts.
 * @return {object} 500 - Error response.
 * @example response - 200 - Success response example
 * [
 *   {
 *     "_id": "1899307514",
 *     "count": 15
 *   },
 *   ...
 * ]
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Server error description"
 * }
 */
router.get('/tx-sent', async (req, res) => {
  const { days, topX, limit = 10, skip = 0 } = req.query;

  try {
    const db = await Database.getInstance();

    let dateFilter = {};

    if (topX && isNaN(parseInt(topX as string))) {
      return res.status(400).send({ msg: 'Invalid value for topX.' });
    }

    if (days && !isNaN(Number(days.toString()))) {
      dateFilter = {
        dateAdded: {
          $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000),
        },
      };
    }

    const pipeline = [
      { $match: dateFilter },
      { $group: { _id: '$senderTgId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $skip: parseInt(skip as string) },
      { $limit: topX ? parseInt(topX as string) : parseInt(limit as string) },
    ];

    if (topX && !isNaN(Number(topX))) {
      pipeline.push({ $limit: parseInt(topX as string) });
    }

    const results = await db
      .collection(TRANSFERS_COLLECTION)
      .aggregate(pipeline)
      .toArray();

    return res.status(200).send(results);
  } catch (error) {
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

/**
 * GET /v1/tokens-sent
 *
 * @summary Get leaderboard for tokens sent
 * @description Retrieves a leaderboard showing users who have sent the most tokens in a given period.
 * @tags Leaderboard
 * @param {string} [request.query.days] - The number of past days to filter results by.
 * @param {string} [request.query.topX] - Limit results to the top X users.
 * @param {string} [request.query.limit=10] - Number of results per page.
 * @param {string} [request.query.skip=0] - Number of results to skip for pagination.
 * @return {object} 200 - Array of users and their total tokens sent.
 * @return {object} 500 - Error response.
 * @example response - 200 - Success response example
 * [
 *   {
 *     "_id": "1899307514",
 *     "totalTokens": "100"
 *   },
 *   ...
 * ]
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Server error description"
 * }
 */
router.get('/tokensent', authenticateApiKey, async (req, res) => {
  const { days, limit = 10, skip = 0, topX } = req.query;

  try {
    const db = await Database.getInstance();

    let dateFilter = {};

    if (topX && isNaN(parseInt(topX as string))) {
      return res.status(400).send({ msg: 'Invalid value for topX.' });
    }

    if (days && !isNaN(Number(days))) {
      dateFilter = {
        dateAdded: {
          $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000),
        },
      };
    }

    const pipeline = [
      { $match: dateFilter },
      {
        $group: {
          _id: '$senderTgId',
          totalTokens: { $sum: { $toDecimal: '$tokenAmount' } },
        },
      },
      { $sort: { totalTokens: -1 } },
      { $skip: parseInt(skip as string) },
      { $limit: topX ? parseInt(topX as string) : parseInt(limit as string) },
    ];

    const results = await db
      .collection(TRANSFERS_COLLECTION)
      .aggregate(pipeline)
      .toArray();

    return res.status(200).send(results);
  } catch (error) {
    console.log(error);
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

/**
 * GET /v1/rewards
 *
 * @summary Get leaderboard for rewards accumulated
 * @description Retrieves a leaderboard showing users with the most accumulated rewards.
 * @tags Leaderboard
 * @param {string} [request.query.days] - The number of past days to filter results by.
 * @param {string} [request.query.topX] - Limit results to the top X users.
 * @param {string} [request.query.limit=10] - Number of results per page.
 * @param {string} [request.query.skip=0] - Number of results to skip for pagination.
 * @return {object} 200 - Array of users and their total rewards accumulated.
 * @return {object} 500 - Error response.
 * @example response - 200 - Success response example
 * [
 *   {
 *     "_id": "66670057",
 *       "totalRewards": {
 *       "$numberDecimal": "2800"
 *     }
 *   },
 *   ...
 * ]
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Server error description"
 * }
 */
router.get('/rewards', authenticateApiKey, async (req, res) => {
  const { days, skip = 0, limit = 10, topX } = req.query;

  let dateFilter = {};

  if (topX && isNaN(parseInt(topX as string))) {
    return res.status(400).send({ msg: 'Invalid value for topX.' });
  }

  if (days && !isNaN(Number(days))) {
    dateFilter = {
      dateAdded: {
        $gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000),
      },
    };
  }

  try {
    const db = await Database.getInstance();
    const pipeline = [
      { $match: dateFilter },
      {
        $group: {
          _id: '$userTelegramID',
          totalRewards: { $sum: { $toDecimal: '$amount' } },
        },
      },
      { $sort: { totalRewards: -1 } },
      { $skip: parseInt(skip as string) },
      { $limit: topX ? parseInt(topX as string) : parseInt(limit as string) },
    ];

    const leaderboard = await db
      .collection(REWARDS_COLLECTION)
      .aggregate(pipeline)
      .toArray();
    return res.status(200).send(leaderboard);
  } catch (error) {
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

export default router;
