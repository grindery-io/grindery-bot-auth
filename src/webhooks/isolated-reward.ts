import {
  PatchResult,
  RewardParams,
  createRewardParams,
} from '../types/webhook.types';
import { TRANSACTION_STATUS } from '../utils/constants';
import {
  IsolatedRewardTelegram,
  createIsolatedRewardTelegram,
} from '../utils/rewards';
import {
  getStatusRewards,
  isPendingTransactionHash,
  isTreatmentDurationExceeded,
  sendTransaction,
  updateTxHash,
  updateUserOpHash,
} from './utils';

/**
 * Handles the processing of an isolated reward based on specified parameters.
 * @param params - The parameters required for the reward.
 * @returns A promise resolving to a boolean value.
 *          - Returns `true` if the reward handling is completed or conditions are not met.
 *          - Returns `false` if an error occurs during the reward processing.
 */
export async function handleIsolatedReward(
  params: RewardParams,
): Promise<boolean> {
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
      createRewardParams(params, params.patchwallet),
    );

    if (!reward) return true;

    reward = reward as IsolatedRewardTelegram;

    // Check if this event already exists
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

    // Update transaction hash and perform additional actions
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
      `[${params.eventId}] Error processing ${params.reason} reward event: ${error}`,
    );
  }

  return true;
}
