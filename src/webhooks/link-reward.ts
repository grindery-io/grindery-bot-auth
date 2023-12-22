import {
  PatchResult,
  RewardParams,
  createRewardParams,
} from '../types/webhook.types';
import { TRANSACTION_STATUS } from '../utils/constants';
import { LinkRewardTelegram, createLinkRewardTelegram } from '../utils/rewards';
import {
  getStatusRewards,
  isPendingTransactionHash,
  isTreatmentDurationExceeded,
  sendTransaction,
  updateTxHash,
  updateUserOpHash,
} from './utils';

/**
 * Handles the processing of a link reward based on specified parameters.
 * @param params - The parameters required for the link reward.
 * @returns A promise resolving to a boolean value.
 *          - Returns `true` if the link reward handling is completed or conditions are not met.
 *          - Returns `false` if an error occurs during the link reward processing.
 */
export async function handleLinkReward(params: RewardParams): Promise<boolean> {
  try {
    let reward = await createLinkRewardTelegram(
      createRewardParams(params, params.patchwallet),
    );

    if (reward == false) return true;

    reward = reward as LinkRewardTelegram;

    let txReward: PatchResult;

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
      if ((txReward = await getStatusRewards(reward)).isError) return false;
    }

    // Check for txReward and send transaction if not present
    if (!txReward && (txReward = await sendTransaction(reward)).isError)
      return false;

    if (txReward && txReward.txHash) {
      updateTxHash(reward, txReward.txHash);
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
    if (txReward && txReward.userOpHash) {
      updateUserOpHash(reward, txReward.userOpHash);
      await reward.updateInDatabase(TRANSACTION_STATUS.PENDING_HASH, null);
    }
    return false;
  } catch (error) {
    console.error(
      `[${params.eventId}] Error processing link reward event: ${error}`,
    );
  }
  return true;
}

export const link_reward_utils = {
  handleLinkReward,
};
