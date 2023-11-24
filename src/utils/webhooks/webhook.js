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
import { createLinkRewardTelegram } from '../rewards.js';

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
    const rewardTest = await createLinkRewardTelegram(
      eventId,
      userTelegramID,
      referentUserTelegramID,
      tokenAddress,
      chainName
    );

    if (rewardTest == false) return true;

    let txReward;

    // Handle pending hash status
    if (rewardTest.isPendingHash()) {
      if (await rewardTest.isTreatmentDurationExceeded()) return true;

      // Check userOpHash and updateInDatabase for success
      if (!rewardTest.userOpHash)
        return (
          await rewardTest.updateInDatabase(
            TRANSACTION_STATUS.SUCCESS,
            new Date()
          ),
          true
        );

      // Get status of reward test
      if ((txReward = await rewardTest.getStatus()) === false) return txReward;
    }

    // Check for txReward and send transaction if not present
    if (!txReward && (txReward = await rewardTest.sendTx()) === false)
      return txReward;

    if (txReward && txReward.data.txHash) {
      rewardTest.updateTxHash(txReward.data.txHash);
      await Promise.all([
        rewardTest.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
        rewardTest.saveToFlowXO(),
      ]).catch((error) =>
        console.error(
          `[${params.eventId}] Error processing FlowXO webhook during sign up reward: ${error}`
        )
      );
      return true;
    }

    // Update userOpHash if present in txReward
    if (txReward && txReward.data.userOpHash) {
      rewardTest.updateUserOpHash(txReward.data.userOpHash);
      await rewardTest.updateInDatabase(TRANSACTION_STATUS.PENDING_HASH, null);
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
