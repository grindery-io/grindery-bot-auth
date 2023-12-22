import {
  PatchResult,
  RewardParams,
  createRewardParams,
} from '../types/webhook.types';
import { TRANSACTION_STATUS } from '../utils/constants';
import { createReferralRewardTelegram } from '../utils/rewards';
import {
  getStatusRewards,
  isPendingTransactionHash,
  isSuccessfulTransaction,
  isTreatmentDurationExceeded,
  sendTransaction,
  updateTxHash,
  updateUserOpHash,
} from './utils';

/**
 * Handles the processing of a referral reward based on specified parameters.
 * @param params - The parameters required for the referral reward.
 * @returns A promise resolving to a boolean value.
 *          - Returns `true` if the referral reward handling is completed or conditions are not met.
 *          - Returns `false` if an error occurs during the referral reward processing.
 */
export async function handleReferralReward(
  params: RewardParams,
): Promise<boolean> {
  try {
    const reward = await createReferralRewardTelegram(
      createRewardParams(params, params.patchwallet),
    );

    if (!(await reward.setParentTx())) return true;
    if (!(await reward.getReferent())) return true;

    await reward.getRewardSameFromDatabase();

    if (
      isSuccessfulTransaction(reward.status) ||
      (await reward.getRewardFromDatabaseWithOtherEventId())
    ) {
      console.log(
        `[${params.eventId}] referral reward already distributed or in process of distribution elsewhere for ${reward.referent.userTelegramID} concerning new user ${params.userTelegramID}`,
      );
      return true;
    }

    await reward.updateReferentWallet();

    if (!reward.tx)
      await reward.updateInDatabase(TRANSACTION_STATUS.PENDING, new Date());

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
          `[${params.eventId}] Error processing FlowXO webhook during referral reward: ${error}`,
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
      `[${params.eventId}] Error processing referral reward event: ${error}`,
    );
  }

  return true;
}

export const referral_utils = {
  handleReferralReward,
};
