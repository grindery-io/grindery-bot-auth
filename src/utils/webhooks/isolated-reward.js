import { Database } from '../../db/conn.js';
import { REWARDS_COLLECTION, TRANSACTION_STATUS } from '../constants.js';
import { createIsolatedRewardTelegram } from '../rewards.js';

/**
 * Handles isolated rewards based on given parameters.
 * @param {Object} params - Parameters necessary for handling the reward.
 * @param {string} params.eventId - The unique identifier for the event.
 * @param {string} params.userTelegramID - The Telegram user ID associated with the reward.
 * @param {string} params.reason - The reason for the reward.
 * @param {number} params.amount - The amount involved in the reward.
 * @param {string} params.message - A message associated with the reward.
 * @param {string} params.responsePath - The response path for the reward.
 * @param {string} params.userHandle - The user handle associated with the reward.
 * @param {string} params.userName - The name of the user receiving the reward.
 * @param {string} params.patchwallet - The patch wallet information.
 * @param {string} params.tokenAddress - The address of the token used in the reward.
 * @param {string} params.chainName - The name of the blockchain network.
 * @returns {boolean} - Returns true if successful, otherwise false.
 */
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

    const rewardTest = await createIsolatedRewardTelegram(
      params.eventId,
      params.userTelegramID,
      params.reason,
      params.amount,
      params.message,
      params.responsePath,
      params.userHandle,
      params.userName,
      params.patchwallet,
      params.tokenAddress,
      params.chainName
    );

    if (!rewardTest) return true;

    const db = await Database.getInstance();

    // Check if this event already exists
    const reward = await db.collection(REWARDS_COLLECTION).findOne({
      userTelegramID: params.userTelegramID,
      eventId: params.eventId,
      reason: params.reason,
    });

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

    // Update transaction hash and perform additional actions
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
    console.error(
      `[${params.eventId}] Error processing ${params.reason} reward event: ${error}`
    );
  }

  return true;
}
