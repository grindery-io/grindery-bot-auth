import { TRANSACTION_STATUS } from '../constants';
import { createReferralRewardTelegram } from '../rewards';
import { RewardParams } from './types';
import {
  getStatusRewards,
  isPendingTransactionHash,
  isSuccessfulTransaction,
  isTreatmentDurationExceeded,
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
    const reward = await createReferralRewardTelegram(params);

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
      if ((txReward = await getStatusRewards(reward)) === false)
        return txReward;
    }

    // Check for txReward and send transaction if not present
    if (!txReward && (txReward = await reward.sendTx()) === false)
      return txReward;

    // Update transaction hash and perform additional actions
    if (txReward && txReward.data.txHash) {
      updateTxHash(reward, txReward.data.txHash);
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
    if (txReward && txReward.data.userOpHash) {
      updateUserOpHash(reward, txReward.data.userOpHash);
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
