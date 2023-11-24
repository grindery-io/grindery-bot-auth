import { Database } from '../../db/conn.js';
import {
  REWARDS_COLLECTION,
  TRANSACTION_STATUS,
  USERS_COLLECTION,
} from '../constants.js';
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  getTxStatus,
  sendTokens,
} from '../patchwallet.js';
import axios from 'axios';
import { reward_helpers } from '../rewardHelpers.js';
import { createUserTelegram } from '../user.js';
import { signup_utils } from './signup-reward.js';
import {
  FLOWXO_NEW_LINK_REWARD_WEBHOOK,
  SOURCE_TG_ID,
} from '../../../secrets.js';
import { referral_utils } from './referral-reward.js';

/**
 * Handles the referral link reward for a user.
 *
 * @param {Object} db - The database object.
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} referentUserTelegramID - The Telegram ID of the referent user.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleLinkReward(
  db,
  eventId,
  userTelegramID,
  referentUserTelegramID,
  tokenAddress,
  chainName
) {
  try {
    const referent = await db
      .collection(USERS_COLLECTION)
      .findOne({ userTelegramID: referentUserTelegramID });

    if (!referent) {
      // The referent user is not in the database
      console.log(
        `[${eventId}] ${referentUserTelegramID} referent user is not a user to process the link reward.`
      );
      return true;
    }

    const rewardWallet =
      referent?.patchwallet ??
      (await getPatchWalletAddressFromTgId(referentUserTelegramID));

    const reward = await db.collection(REWARDS_COLLECTION).findOne({
      eventId: eventId,
      userTelegramID: referentUserTelegramID,
      sponsoredUserTelegramID: userTelegramID,
      reason: 'referral_link',
    });

    // Check if the user has already received a signup reward
    if (
      reward?.status === TRANSACTION_STATUS.SUCCESS ||
      (await db.collection(REWARDS_COLLECTION).findOne({
        sponsoredUserTelegramID: userTelegramID,
        reason: 'referral_link',
        eventId: { $ne: eventId },
      }))
    ) {
      // The user has already received a referral link reward, stop processing
      console.log(
        `[${eventId}] ${userTelegramID} already sponsored another user for a referral link reward.`
      );
      return true;
    }

    if (!reward) {
      await reward_helpers.insertRewardDB(db, {
        eventId: eventId,
        userTelegramID: referentUserTelegramID,
        responsePath: referent.responsePath,
        walletAddress: rewardWallet,
        reason: 'referral_link',
        userHandle: referent.userHandle,
        userName: referent.userName,
        amount: '10',
        message: 'Referral link',
        dateAdded: new Date(),
        sponsoredUserTelegramID: userTelegramID,
        status: TRANSACTION_STATUS.PENDING,
      });

      console.log(
        `[${eventId}] pending link reward for ${rewardWallet} about sponsoring ${userTelegramID} added to the database.`
      );
    }

    let txReward = undefined;

    if (reward?.status === TRANSACTION_STATUS.PENDING_HASH) {
      if (reward.dateAdded < new Date(new Date() - 10 * 60 * 1000)) {
        console.log(
          `[${eventId}] was stopped due to too long treatment duration (> 10 min).`
        );

        await reward_helpers.updateRewardDB(db, {
          userTelegramID: referentUserTelegramID,
          eventId: eventId,
          reason: 'referral_link',
          responsePath: referent.responsePath,
          walletAddress: rewardWallet,
          reason: 'referral_link',
          userHandle: referent.userHandle,
          userName: referent.userName,
          amount: '10',
          message: 'Referral link',
          dateAdded: new Date(),
          sponsoredUserTelegramID: userTelegramID,
          status: TRANSACTION_STATUS.FAILURE,
        });

        return true;
      }

      if (reward?.userOpHash) {
        try {
          txReward = await getTxStatus(reward.userOpHash);
        } catch (error) {
          console.error(
            `[${eventId}] Error processing PatchWallet link reward reward status for ${referentUserTelegramID}: ${error}`
          );
          return false;
        }
      } else {
        // Update the reward record to mark it as successful
        await reward_helpers.updateRewardDB(db, {
          eventId: eventId,
          userTelegramID: referentUserTelegramID,
          responsePath: referent.responsePath,
          walletAddress: rewardWallet,
          reason: 'referral_link',
          userHandle: referent.userHandle,
          userName: referent.userName,
          amount: '10',
          message: 'Referral link',
          dateAdded: new Date(),
          sponsoredUserTelegramID: userTelegramID,
          status: TRANSACTION_STATUS.SUCCESS,
        });
        return true;
      }
    }

    if (!txReward) {
      try {
        txReward = await sendTokens(
          SOURCE_TG_ID,
          rewardWallet,
          '10',
          await getPatchWalletAccessToken(),
          tokenAddress,
          chainName
        );
      } catch (error) {
        console.error(
          `[${eventId}] Error processing PatchWallet link reward for ${rewardWallet}: ${error}`
        );
        return false;
      }
    }

    if (txReward.data.txHash) {
      const dateAdded = new Date();

      // Add the reward to the "rewards" collection
      await reward_helpers.updateRewardDB(db, {
        userTelegramID: referentUserTelegramID,
        sponsoredUserTelegramID: userTelegramID,
        reason: 'referral_link',
        eventId: eventId,
        responsePath: referent.responsePath,
        walletAddress: rewardWallet,
        userHandle: referent.userHandle,
        userName: referent.userName,
        amount: '10',
        message: 'Referral link',
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
        status: TRANSACTION_STATUS.SUCCESS,
      });

      console.log(
        `[${txReward.data.txHash}] link reward added to Mongo DB with event ID ${eventId}.`
      );

      await axios.post(FLOWXO_NEW_LINK_REWARD_WEBHOOK, {
        userTelegramID: referentUserTelegramID,
        responsePath: referent.responsePath,
        walletAddress: rewardWallet,
        reason: 'referral_link',
        userHandle: referent.userHandle,
        userName: referent.userName,
        amount: '10',
        message: 'Referral link',
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
        sponsoredUserTelegramID: userTelegramID,
      });

      console.log(
        `[${txReward.data.txHash}] link reward sent to FlowXO with event ID ${eventId}.`
      );

      return true;
    }

    if (txReward.data.userOpHash) {
      await reward_helpers.updateRewardDB(db, {
        userTelegramID: referentUserTelegramID,
        sponsoredUserTelegramID: userTelegramID,
        reason: 'referral_link',
        eventId: eventId,
        responsePath: referent.responsePath,
        walletAddress: rewardWallet,
        userHandle: referent.userHandle,
        userName: referent.userName,
        amount: '10',
        message: 'Referral link',
        status: TRANSACTION_STATUS.PENDING_HASH,
        userOpHash: txReward.data.userOpHash,
      });
    }

    return false;
  } catch (error) {
    console.error(`[${eventId}] Error processing link reward event: ${error}`);
  }
  return true;
}

/**
 * Handles the processing of a new reward for a user.
 *
 * @param {Object} params - The parameters containing user and event details.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleNewReward(params) {
  const db = await Database.getInstance();

  const user = await createUserTelegram(
    params.userTelegramID,
    params.responsePath,
    params.userHandle,
    params.userName
  );

  if (user.isInDatabase) {
    // The user already exists, stop processing
    console.log(
      `[${params.eventId}] ${user.userTelegramID} user already exists.`
    );
    return true;
  }

  if (!user.patchwallet) {
    return false;
  }

  if (
    !(await signup_utils.handleSignUpReward({
      ...params,
      patchwallet: user.patchwallet,
    }))
  ) {
    return false;
  }

  if (
    !(await referral_utils.handleReferralReward({
      ...params,
      patchwallet: user.patchwallet,
    }))
  ) {
    return false;
  }

  if (params.referentUserTelegramID) {
    if (
      !(await webhook_utils.handleLinkReward(
        db,
        params.eventId,
        params.userTelegramID,
        params.referentUserTelegramID,
        params.tokenAddress,
        params.chainName
      ))
    ) {
      return false;
    }
  }

  if (!(await user.isUserInDatabase())) {
    await user.saveToDatabase(params.eventId);
    await user.saveToSegment(params.eventId);
  }

  return true;
}

export const webhook_utils = {
  handleLinkReward,
};
