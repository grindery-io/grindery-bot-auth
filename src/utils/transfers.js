import { Database } from '../db/conn.js';
import {
  REWARDS_COLLECTION,
  TRANSACTION_STATUS,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from './constants.js';
import 'dotenv/config';
import { getPatchWalletAddressFromTgId } from './patchwallet.js';
import { addTrackSegment } from './segment.js';
import axios from 'axios';

export async function getIncomingTxsUser(db, userId, start, limit) {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .find({ recipientTgId: userId })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(async (entry) => ({
      ...entry,
      dateAdded: formatDate(entry.dateAdded),
      senderUserHandle:
        (
          await db
            .collection(USERS_COLLECTION)
            .findOne({ userTelegramID: entry.senderTgId })
        )?.userHandle || null,
    }))
  );
}

export async function getOutgoingTxsUser(db, userId, start, limit) {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .find({ senderTgId: userId })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(async (entry) => ({
      ...entry,
      dateAdded: formatDate(entry.dateAdded),
      recipientUserHandle:
        (
          await db
            .collection(USERS_COLLECTION)
            .findOne({ userTelegramID: entry.recipientTgId })
        )?.userHandle || null,
    }))
  );
}

export async function getOutgoingTxsToNewUsers(db, userId, start, limit) {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .aggregate([
          {
            $match: {
              senderTgId: userId,
              recipientTgId: { $ne: null },
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
          {
            $sort: {
              dateAdded: -1,
            },
          },
          {
            $skip: start,
          },
          ...(limit > 0
            ? [
                {
                  $limit: limit,
                },
              ]
            : []),
        ])
        .toArray()
    ).map(async (entry) => ({
      ...entry,
      dateAdded: formatDate(entry.dateAdded),
    }))
  );
}

export async function getRewardTxsUser(db, userId, start, limit) {
  return (
    await db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: userId })
      .sort({ dateAdded: -1 })
      .skip(start)
      .limit(limit)
      .toArray()
  ).map((entry) => ({
    ...entry,
    dateAdded: formatDate(entry.dateAdded),
  }));
}

export async function getRewardLinkTxsUser(db, userId, start, limit) {
  return await Promise.all(
    (
      await db
        .collection(REWARDS_COLLECTION)
        .find({ userTelegramID: userId, reason: 'referral_link' })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(async (entry) => ({
      ...entry,
      dateAdded: formatDate(entry.dateAdded),
      sponsoredUserHandle:
        (
          await db
            .collection(USERS_COLLECTION)
            .findOne({ userTelegramID: entry.sponsoredUserTelegramID })
        )?.userHandle || null,
    }))
  );
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
  });
}

export async function createTransferTelegram(
  eventId,
  senderInformation,
  recipientTgId,
  amount
) {
  const transfer = new TransferTelegram(
    eventId,
    senderInformation,
    recipientTgId,
    amount
  );
  const res = await transfer.initializeTransferDatabase();
  return !res ? false : transfer;
}

export class TransferTelegram {
  constructor(eventId, senderInformation, recipientTgId, amount) {
    this.eventId = eventId;
    this.senderInformation = senderInformation;
    this.recipientTgId = recipientTgId;
    this.amount = amount.toString();
    this.isInDatabase = false;
    this.tx = undefined;
    this.status = undefined;
    this.recipientWallet = undefined;
    this.txHash = undefined;
    this.userOpHash = undefined;
  }

  async initializeTransferDatabase() {
    this.db = await Database.getInstance();
    this.tx = await this.getTransferFromDatabase();

    try {
      this.recipientWallet = await getPatchWalletAddressFromTgId(
        this.recipientTgId
      );
    } catch (error) {
      return false;
    }

    if (this.tx) {
      this.isInDatabase = true;
      this.status = this.tx.status;
      this.userOpHash = this.tx.userOpHash;
    } else {
      await this.updateInDatabase(TRANSACTION_STATUS.PENDING, new Date());
    }

    return true;
  }

  async getTransferFromDatabase() {
    return await this.db
      .collection(TRANSFERS_COLLECTION)
      .findOne({ eventId: this.eventId });
  }

  async updateInDatabase(status, date) {
    await this.db.collection(TRANSFERS_COLLECTION).updateOne(
      { eventId: this.eventId },
      {
        $set: {
          eventId: this.eventId,
          chainId: 'eip155:137',
          tokenSymbol: 'g1',
          tokenAddress: process.env.G1_POLYGON_ADDRESS,
          senderTgId: this.senderInformation.userTelegramID,
          senderWallet: this.senderInformation.patchwallet,
          senderName: this.senderInformation.userName,
          senderHandle: this.senderInformation.userHandle,
          recipientTgId: this.recipientTgId,
          recipientWallet: this.recipientWallet,
          tokenAmount: this.amount,
          status: status,
          ...(date !== null ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
        },
      },
      { upsert: true }
    );
    console.log(
      `[${this.eventId}] transaction from ${this.senderTgId} to ${this.recipientTgId} for ${this.amount} in MongoDB as ${status} with transaction hash : ${this.txHash}.`
    );
  }

  async checkOOT() {
    if (this.tx.dateAdded < new Date(new Date() - 10 * 60 * 1000)) {
      console.log(
        `[${this.eventId}] was stopped due to too long treatment duration (> 10 min).`
      );

      await this.updateInDatabase(TRANSACTION_STATUS.FAILURE, new Date());

      return true;
    }

    return false;
  }

  updateTxHash(txHash) {
    this.txHash = txHash;
    return this.txHash;
  }

  updateUserOpHash(userOpHash) {
    this.userOpHash = userOpHash;
    return this.userOpHash;
  }

  async saveToSegment() {
    try {
      const trackSegment = await addTrackSegment({
        userTelegramID: this.senderInformation.userTelegramID,
        senderTgId: this.senderInformation.userTelegramID,
        senderWallet: this.senderInformation.patchwallet,
        senderName: this.senderInformation.userName,
        senderHandle: this.senderInformation.userHandle,
        recipientTgId: this.recipientTgId,
        recipientWallet: this.recipientWallet,
        tokenAmount: this.amount,
        transactionHash: this.txHash,
        dateAdded: new Date(),
        eventId: this.eventId,
      });

      console.log(
        `[${this.txHash}] transaction with event ID ${this.eventId} from ${this.senderInformation.senderTgId} to ${this.senderInformation.recipientTgId} for ${this.amount} added to Segment.`
      );

      return trackSegment;
    } catch (error) {
      console.error(
        `[${eventId}] Error processing new transaction in Segment: ${error}`
      );
    }

    return undefined;
  }

  async saveToFlowXO() {
    try {
      const flowXO = await axios.post(
        process.env.FLOWXO_NEW_TRANSACTION_WEBHOOK,
        {
          senderResponsePath: this.senderInformation.responsePath,
          chainId: 'eip155:137',
          tokenSymbol: 'g1',
          tokenAddress: process.env.G1_POLYGON_ADDRESS,
          senderTgId: this.senderInformation.userTelegramID,
          senderWallet: this.senderInformation.patchwallet,
          senderName: this.senderInformation.userName,
          senderHandle: this.senderInformation.userHandle,
          recipientTgId: this.recipientTgId,
          recipientWallet: this.recipientWallet,
          tokenAmount: this.amount,
          transactionHash: this.txHash,
          dateAdded: new Date(),
        }
      );

      console.log(
        `[${this.txHash}] transaction with event ID ${this.eventId} from ${this.senderInformation.userTelegramID} to ${this.recipientTgId} for ${this.amount} sent to FlowXO.`
      );

      return flowXO;
    } catch (error) {
      console.error(
        `[${eventId}] Error processing new transaction in FlowXO: ${error}`
      );
    }

    return undefined;
  }
}
