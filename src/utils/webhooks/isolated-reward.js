import { Database } from '../../db/conn.js';
import { REWARDS_COLLECTION, TRANSACTION_STATUS } from '../constants.js';
import {
  getPatchWalletAccessToken,
  getTxStatus,
  sendTokens,
} from '../patchwallet.js';
import axios from 'axios';
import 'dotenv/config';
import { reward_helpers } from '../rewardHelpers.js';

export async function handleIsolatedReward(params) {
  try {
    if (
      !params.userTelegramID ||
      !params.eventId ||
      !params.amount ||
      !params.reason
    ) {
      return true;
    }

    const db = await Database.getInstance();

    // Check if this event already exists
    const reward = await db.collection(REWARDS_COLLECTION).findOne({
      userTelegramID: params.userTelegramID,
      eventId: params.eventId,
      reason: params.reason,
    });

    if (
      reward?.status === TRANSACTION_STATUS.SUCCESS ||
      (await db.collection(REWARDS_COLLECTION).findOne({
        userTelegramID: params.userTelegramID,
        eventId: { $ne: params.eventId },
        reason: params.reason,
      }))
    ) {
      // The user has already received a reward with this reason, stop processing
      console.log(
        `[${params.eventId}] ${params.userTelegramID} user already received a reward with the reason: ${params.reason}.`
      );
      return true;
    }

    if (!reward) {
      // Create a new reward record
      await reward_helpers.insertRewardDB(db, {
        eventId: params.eventId,
        userTelegramID: params.userTelegramID,
        responsePath: params.responsePath,
        walletAddress: params.patchwallet,
        reason: params.reason,
        userHandle: params.userHandle,
        userName: params.userName,
        amount: params.amount,
        message: params.message,
        dateAdded: new Date(),
        status: TRANSACTION_STATUS.PENDING,
      });

      console.log(
        `[${params.eventId}] pending reward with reason ${params.reason} added to the database.`
      );
    }

    let txReward = undefined;

    if (reward?.status === TRANSACTION_STATUS.PENDING_HASH) {
      if (reward.dateAdded < new Date(new Date() - 10 * 60 * 1000)) {
        console.log(
          `[${params.eventId}] was stopped due to too long treatment duration (> 10 min).`
        );

        await reward_helpers.updateRewardDB(db, {
          userTelegramID: params.userTelegramID,
          eventId: params.eventId,
          reason: params.reason,
          responsePath: params.responsePath,
          walletAddress: params.patchwallet,
          userHandle: params.userHandle,
          userName: params.userName,
          amount: params.amount,
          message: params.message,
          status: TRANSACTION_STATUS.FAILURE,
        });
        return true;
      }

      if (reward?.userOpHash) {
        try {
          txReward = await getTxStatus(reward.userOpHash);
        } catch (error) {
          console.error(
            `[${params.eventId}] Error processing PatchWallet ${params.reason} reward status for ${params.userTelegramID}: ${error}`
          );
          return false;
        }
      } else {
        // Update the reward record to mark it as successful
        await reward_helpers.updateRewardDB(db, {
          userTelegramID: params.userTelegramID,
          eventId: params.eventId,
          reason: params.reason,
          responsePath: params.responsePath,
          walletAddress: params.patchwallet,
          userHandle: params.userHandle,
          userName: params.userName,
          amount: params.amount,
          message: params.message,
          status: TRANSACTION_STATUS.SUCCESS,
          dateAdded: new Date(),
        });
        return true;
      }
    }

    if (!txReward) {
      try {
        // Send tokens to the user
        txReward = await sendTokens(
          process.env.SOURCE_TG_ID,
          params.patchwallet,
          params.amount,
          await getPatchWalletAccessToken()
        );
      } catch (error) {
        console.error(
          `[${params.eventId}] Error processing PatchWallet ${params.reason} reward for ${params.userTelegramID}: ${error}`
        );
        return false;
      }
    }

    if (txReward.data.txHash) {
      const dateAdded = new Date();

      // Update the reward record to mark it as successful
      await reward_helpers.updateRewardDB(db, {
        userTelegramID: params.userTelegramID,
        eventId: params.eventId,
        reason: params.reason,
        responsePath: params.responsePath,
        walletAddress: params.patchwallet,
        userHandle: params.userHandle,
        userName: params.userName,
        amount: params.amount,
        message: params.message,
        status: TRANSACTION_STATUS.SUCCESS,
        transactionHash: txReward.data.txHash,
        dateAdded: new Date(),
      });

      // Find the reward record by transaction hash
      const reward_db = await db
        .collection(REWARDS_COLLECTION)
        .findOne({ eventId: params.eventId });

      console.log(
        `[${txReward.data.txHash}] ${
          params.reason
        } reward added to Mongo DB with event ID ${
          params.eventId
        } and Object ID ${reward_db._id.toString()}.`
      );

      // Notify external system about the reward
      await axios.post(process.env.FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK, {
        userTelegramID: params.userTelegramID,
        responsePath: params.responsePath,
        walletAddress: params.patchwallet,
        reason: params.reason,
        userHandle: params.userHandle,
        userName: params.userName,
        amount: params.amount,
        message: params.message,
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
      });

      return true;
    }

    if (txReward.data.userOpHash) {
      await reward_helpers.updateRewardDB(db, {
        userTelegramID: params.userTelegramID,
        eventId: params.eventId,
        reason: params.reason,
        status: TRANSACTION_STATUS.PENDING_HASH,
        userOpHash: txReward.data.userOpHash,
      });

      // Find the reward record by transaction hash
      const reward_db = await db
        .collection(REWARDS_COLLECTION)
        .findOne({ userOpHash: txReward.data.userOpHash });

      console.log(
        `[${txReward.data.userOpHash}] ${
          params.reason
        } reward userOpHash added to Mongo DB with event ID ${
          params.eventId
        } and Object ID ${reward_db._id.toString()}.`
      );
    }

    return false;
  } catch (error) {
    console.error(
      `[${params.eventId}] Error processing ${params.reason} reward event: ${error}`
    );
  }

  return true;
}