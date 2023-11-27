import { TRANSACTION_STATUS } from '../constants';
import {
  IsolatedRewardTelegram,
  createIsolatedRewardTelegram,
} from '../rewards';

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
export async function handleIsolatedReward(params: any): Promise<boolean> {
  try {
    if (
      !params.userTelegramID ||
      !params.eventId ||
      !params.amount ||
      !params.reason
    ) {
      return true;
    }

    let reward = await createIsolatedRewardTelegram(
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
      params.chainName,
    );

    if (!reward) return true;

    reward = reward as IsolatedRewardTelegram;

    // Check if this event already exists
    let txReward;

    // Handle pending hash status
    if (reward.isPendingHash()) {
      if (await reward.isTreatmentDurationExceeded()) return true;

      // Check userOpHash and updateInDatabase for success
      if (!reward.userOpHash)
        return (
          await reward.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
          true
        );

      // Get status of reward test
      if ((txReward = await reward.getStatus()) === false) return txReward;
    }

    // Check for txReward and send transaction if not present
    if (!txReward && (txReward = await reward.sendTx()) === false)
      return txReward;

    // Update transaction hash and perform additional actions
    if (txReward && txReward.data.txHash) {
      reward.updateTxHash(txReward.data.txHash);
      await Promise.all([
        reward.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
        reward.saveToFlowXO(),
      ]).catch((error) =>
        console.error(
          `[${params.eventId}] Error processing FlowXO webhook during sign up reward: ${error}`,
        ),
      );
      return true;
    }

    // Update userOpHash if present in txReward
    if (txReward && txReward.data.userOpHash) {
      reward.updateUserOpHash(txReward.data.userOpHash);
      await reward.updateInDatabase(TRANSACTION_STATUS.PENDING_HASH, null);
    }
    return false;
  } catch (error) {
    console.error(
      `[${params.eventId}] Error processing ${params.reason} reward event: ${error}`,
    );
  }

  return true;
}
