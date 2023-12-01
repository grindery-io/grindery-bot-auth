import { G1_POLYGON_ADDRESS } from '../../../secrets';
import { TRANSACTION_STATUS } from '../constants';
import { LinkRewardTelegram, createLinkRewardTelegram } from '../rewards';
import { isPendingTransactionHash, isTreatmentDurationExceeded } from './utils';

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
  eventId: string,
  userTelegramID: string,
  referentUserTelegramID: string,
  tokenAddress = G1_POLYGON_ADDRESS,
  chainName = 'matic',
): Promise<boolean> {
  try {
    let reward = await createLinkRewardTelegram(
      eventId,
      userTelegramID,
      referentUserTelegramID,
      tokenAddress,
      chainName,
    );

    if (reward == false) return true;

    reward = reward as LinkRewardTelegram;

    let txReward;

    // Handle pending hash status
    if (isPendingTransactionHash(reward.status)) {
      if (await isTreatmentDurationExceeded(reward)) return true;

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

    if (txReward && txReward.data.txHash) {
      reward.updateTxHash(txReward.data.txHash);
      await Promise.all([
        reward.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
        reward.saveToFlowXO(),
      ]).catch((error) =>
        console.error(
          `[${eventId}] Error processing FlowXO webhook during sign up reward: ${error}`,
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
    console.error(`[${eventId}] Error processing link reward event: ${error}`);
  }
  return true;
}

export const link_reward_utils = {
  handleLinkReward,
};
