import { RewardParams } from '../../types/webhook.types';
import { TRANSACTION_STATUS } from '../constants';
import { SignUpRewardTelegram, createSignUpRewardTelegram } from '../rewards';
import {
  getStatusRewards,
  isPendingTransactionHash,
  isTreatmentDurationExceeded,
  updateTxHash,
  updateUserOpHash,
} from './utils';

/**
 * Handles the processing of a sign-up reward based on specified parameters.
 * @param params - The parameters required for the sign-up reward.
 * @returns A promise resolving to a boolean value.
 *          - Returns `true` if the sign-up reward handling is completed or conditions are not met.
 *          - Returns `false` if an error occurs during the sign-up reward processing.
 */
export async function handleSignUpReward(
  params: RewardParams,
): Promise<boolean> {
  try {
    // Create a sign-up reward object
    let reward = await createSignUpRewardTelegram(params);

    // If reward already exists, return true
    if (!reward) return true;

    reward = reward as SignUpRewardTelegram;

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
      if ((txReward = await getStatusRewards(reward)).isError) return false;
    }

    // Check for txReward and send transaction if not present
    if (!txReward && (txReward = await reward.sendTx()).isError) return false;

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
    // Handle error
    console.error(
      `[${params.eventId}] Error processing sign up reward event: ${error}`,
    );
  }

  return true;
}

export const signup_utils = {
  handleSignUpReward,
};
