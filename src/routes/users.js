import express from 'express';
import { Database } from '../db/conn.js';
import { authenticateApiKey } from '../utils/auth.js';
import { USERS_COLLECTION } from '../utils/constants.js';
import 'dotenv/config';

const router = express.Router();

router.post('/attributes', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();

    if (!Array.isArray(req.body)) {
      return res.status(400).send({
        msg: 'Request body should contain an array of attribute objects.',
      });
    }

    return res.status(200).send({
      msg: 'Updates successful',
      result: await db.collection(USERS_COLLECTION).bulkWrite(
        req.body.map((update) => {
          const { userTelegramID, attributeNames } = update;

          if (
            !Array.isArray(attributeNames) ||
            typeof userTelegramID !== 'string'
          ) {
            return res.status(400).send({
              msg: 'Each item in the array should have "userTelegramID" as string, "attributeNames" as an array.',
            });
          }

          return {
            updateOne: {
              filter: { userTelegramID },
              update: { $set: { attributes: attributeNames } },
              upsert: true,
            },
          };
        })
      ),
    });
  } catch (error) {
    console.log(error);
    res.status(500).send({ msg: 'An error occurred', error });
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
    res.status(500).send({ msg: 'An error occurred', error });
  }
});

export default router;
