import express from 'express';
import { Database } from '../db/conn.js';
import { authenticateApiKey } from '../utils/auth.js';
import {
  REWARDS_COLLECTION,
  TRANSFERS_COLLECTION,
} from '../utils/constants.js';
import Web3 from 'web3';
import { CHAIN_MAPPING } from '../utils/chains.js';
import 'dotenv/config';
import BigNumber from 'bignumber.js';
import ERC20 from './abi/ERC20.json' assert { type: 'json' };
import axios from 'axios';

const router = express.Router();

router.post('/hacker', authenticateApiKey, async (req, res) => {
  try {
    const web3 = new Web3(CHAIN_MAPPING[req.body.chainId][1]);
    const contract = new web3.eth.Contract(
      ERC20,
      process.env.G1_POLYGON_ADDRESS
    );

    const walletAddress =
      req.body.patchWalletAddress ||
      (
        await axios.post('https://paymagicapi.com/v1/resolver', {
          userIds: `grindery:${req.body.userTelegramID}`,
        })
      ).data.users[0].accountAddress;

    const balance = await contract.methods.balanceOf(walletAddress).call();

    const balanceEther = BigNumber(balance)
      .div(
        BigNumber(10).pow(BigNumber(await contract.methods.decimals().call()))
      )
      .toString();

    return res.status(200).send({
      balanceWei: balance,
      balanceEther,
      isHacker:
        parseFloat(balanceEther) > 100000 &&
        walletAddress !== process.env.SOURCE_WALLET_ADDRESS,
    });
  } catch (error) {
    return res.status(500).send({ msg: 'An error occurred', error });
  }
});

router.post('/slave', authenticateApiKey, async (req, res) => {
  try {
    const db = await Database.getInstance();
    const rewardsDocument = await db.collection(REWARDS_COLLECTION).findOne({
      userTelegramID: req.body.userTelegramID,
      reason: 'user_sign_up',
    });

    if (!rewardsDocument) {
      return res.status(404).send({
        msg: `Sign up reward not found for the provided userTelegramID ${req.body.userTelegramID}.`,
      });
    }

    // Count the transfers in the transfers collection
    const transfersCount = await db
      .collection(TRANSFERS_COLLECTION)
      .find({
        recipientTgId: req.body.userTelegramID,
        dateAdded: { $lt: rewardsDocument.dateAdded },
      })
      .count();

    res.status(200).send({
      transfers_before_activation: transfersCount.toString(),
      isSlave: transfersCount > 2,
    });
  } catch (error) {
    console.error('An error occurred:', error);
    res.status(500).send({ msg: 'An error occurred', error });
  }
});

export default router;
