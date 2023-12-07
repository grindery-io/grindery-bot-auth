import express from 'express';
import { Database } from '../db/conn';
import { authenticateApiKey } from '../utils/auth';
import { USERS_COLLECTION } from '../utils/constants';
import axios from 'axios';
import { ANKR_KEY } from '../../secrets';

const router = express.Router();

router.post('/attributes', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    if (!Array.isArray(req.body)) {
      return res.status(400).send({
        msg: 'Request body should contain an array of attribute objects.',
      });
    }

    const isValid = req.body.every((update) => {
      const { userTelegramID, attributeNames } = update;
      return (
        Array.isArray(attributeNames) && typeof userTelegramID === 'string'
      );
    });

    if (!isValid) {
      return res.status(400).send({
        msg: 'Each item in the array should have "userTelegramID" as string, "attributeNames" as an array.',
      });
    }

    const bulkOperations = req.body.map((update) => ({
      updateOne: {
        filter: { userTelegramID: update.userTelegramID },
        update: { $set: { attributes: update.attributeNames } },
        upsert: true,
      },
    }));

    const result = await db
      .collection(USERS_COLLECTION)
      .bulkWrite(bulkOperations);

    return res.status(200).send({
      msg: 'Updates successful',
      result,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

router.get('/attributes', authenticateApiKey, async (req, res) => {
  try {
    const { userTelegramID } = req.query;

    if (!userTelegramID) {
      return res.status(400).send({
        msg: 'User Telegram ID is required.',
      });
    }

    const db = await Database.getInstance();
    const user = await db
      .collection(USERS_COLLECTION)
      .findOne({ userTelegramID });

    return res.status(200).send({
      userTelegramID,
      attributes: user?.attributes,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

router.get('/balance', authenticateApiKey, async (req, res) => {
  console.log(`User [${req.query.userTelegramID}] requested balance`);
  try {
    const db = await Database.getInstance();

    const user = await db
      .collection(USERS_COLLECTION)
      .findOne({ userTelegramID: req.query.userTelegramID });

    if (!user) {
      return res.status(400).json({ error: 'User is not in the database' });
    }

    const balance = await axios.post(
      `https://rpc.ankr.com/multichain/${ANKR_KEY}`,
      {
        jsonrpc: '2.0',
        method: 'ankr_getAccountBalance',
        params: {
          blockchain: req.query.chain
            ? (req.query.chain as string).split(',')
            : 'polygon',
          walletAddress: user?.patchwallet || '',
          onlyWhitelisted: false,
        },
        id: new Date().toString(),
      },
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );

    console.log(`User [${req.query.userTelegramID}] balance request completed`);
    return res.status(200).json(balance.data?.result || {});
  } catch (error) {
    console.error(
      `Error getting balance for user ${req.query.userTelegramID}`,
      JSON.stringify(error),
    );
    return res.status(500).send({ success: false, error: 'An error occurred' });
  }
});

export default router;
