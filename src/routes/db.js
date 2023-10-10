import express from 'express';
import { Database } from '../db/conn.js';
import { authenticateApiKey } from '../utils/auth.js';
import {
  getIncomingTxsUser,
  getOutgoingTxsUser,
  getRewardTxsUser,
} from '../utils/transfers.js';
import { TRANSFERS_COLLECTION, USERS_COLLECTION } from '../utils/constants.js';

const router = express.Router();

router.post('/:collectionName', authenticateApiKey, async (req, res) => {
  const collectionName = req.params.collectionName;
  const db = await Database.getInstance(req);
  const collection = db.collection(collectionName);

  res.status(201).send(
    await collection.insertOne({
      ...req.body,
      dateAdded: new Date(),
    })
  );
});

router.get('/backlog-signup-rewards', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    return res.status(200).send(
      await db
        .collection('users')
        .find({
          userTelegramID: {
            $nin: await db.collection('rewards').distinct('userTelegramID', {
              amount: '100',
            }),
          },
        })
        .toArray()
    );
  } catch (error) {
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

router.get('/transactions-total', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance(req);

    res.status(200).send({
      transactions_counts: await db
        .collection(TRANSFERS_COLLECTION)
        .countDocuments(),
    });
  } catch (error) {
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

router.get('/users-total', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance(req);

    res.status(200).send({
      users_counts: await db.collection(USERS_COLLECTION).countDocuments(),
    });
  } catch (error) {
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

router.get('/transactions-count', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance(req);
    const txs = await db
      .collection('transfers')
      .find({ senderTgId: req.query.userId })
      .toArray();
    res
      .status(200)
      .send({ transactions: txs, transactions_counts: txs.length });
  } catch (error) {
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

router.get('/transactions-new-users', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance(req);

    const txs = await db
      .collection('transfers')
      .aggregate([
        {
          $match: {
            senderTgId: req.query.userId,
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'recipientTgId',
            foreignField: 'userTelegramID',
            as: 'user',
          },
        },
        {
          $match: {
            user: { $size: 0 },
          },
        },
        {
          $project: {
            user: 0,
          },
        },
      ])
      .toArray();

    res
      .status(200)
      .send({ transactions: txs, transactions_counts: txs.length });
  } catch (error) {
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

router.get(
  '/transactions-existing-users',
  authenticateApiKey,
  async (req, res) => {
    try {
      const db = await Database.getInstance(req);

      const txs = await db
        .collection('transfers')
        .aggregate([
          {
            $match: {
              senderTgId: req.query.userId,
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'recipientTgId',
              foreignField: 'userTelegramID',
              as: 'user',
            },
          },
          {
            $match: {
              user: { $ne: [] },
            },
          },
          {
            $project: {
              user: 0,
            },
          },
        ])
        .toArray();

      res
        .status(200)
        .send({ transactions: txs, transactions_counts: txs.length });
    } catch (error) {
      return res.status(500).send({ msg: 'An error occurred', error });
    }
  }
);

router.get('/referral-link-count', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance(req);
    const rewards = await db
      .collection('rewards')
      .find({ userTelegramID: req.query.userId, reason: 'referral_link' })
      .toArray();
    res
      .status(200)
      .send({ link_rewards: rewards, link_rewards_counts: rewards.length });
  } catch (error) {
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

router.get('/format-transfers-user', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance(req);
    const start =
      parseInt(req.query.start) >= 0 ? parseInt(req.query.start) : 0;
    const limit =
      req.query.limit && parseInt(req.query.limit) > 0
        ? parseInt(req.query.limit)
        : 0;

    let formattedTxs = '';

    formattedTxs += await getIncomingTxsUser(
      db,
      req.query.userTgId,
      start,
      limit
    ).then((incomingTxs) => {
      return incomingTxs.length > 0
        ? `<b>Incoming transfers:</b>\n${incomingTxs
            .map(
              (transfer) =>
                `- ${transfer.tokenAmount} g1 from @${
                  transfer.senderUserHandle
                } on ${transfer.dateAdded} ${
                  transfer.message ? `[${transfer.message}]` : ''
                }`
            )
            .join('\n')}\n\n`
        : '';
    });

    formattedTxs += await getOutgoingTxsUser(
      db,
      req.query.userTgId,
      start,
      limit
    ).then((outgoingTxs) => {
      return outgoingTxs.length > 0
        ? `<b>Outgoing transfers:</b>\n${outgoingTxs
            .map(
              (transfer) =>
                `- ${transfer.tokenAmount} g1 to ${
                  transfer.recipientUserHandle
                    ? `@${transfer.recipientUserHandle}`
                    : `a new user (Telegram ID: ${transfer.recipientTgId})`
                } on ${transfer.dateAdded} ${
                  transfer.message ? `[${transfer.message}]` : ''
                }`
            )
            .join('\n')}\n\n`
        : '';
    });

    formattedTxs += await getRewardTxsUser(
      db,
      req.query.userTgId,
      start,
      limit
    ).then((rewardTxs) => {
      return rewardTxs.length > 0
        ? `<b>Reward transfers:</b>\n${rewardTxs
            .map(
              (transfer) =>
                `- ${transfer.amount} g1 on ${transfer.dateAdded} ${
                  transfer.message ? `[${transfer.message}]` : ''
                }`
            )
            .join('\n')}\n\n`
        : '';
    });

    res.status(200).send({ formattedTxs: formattedTxs.trimEnd() });
  } catch (error) {
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

router.get('/:collectionName', authenticateApiKey, async (req, res) => {
  const { limit, start, ...query } = req.query;
  try {
    const db = await Database.getInstance(req);
    return res.status(200).send(
      await db
        .collection(req.params.collectionName)
        .find(query)
        .skip(parseInt(start) >= 0 ? parseInt(start) : 0)
        .limit(limit !== undefined && parseInt(limit) > 0 ? parseInt(limit) : 0)
        .toArray()
    );
  } catch (error) {
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

export default router;
