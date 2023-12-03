import { TRANSACTION_STATUS } from '../constants';
import { createReferralRewardTelegram } from '../rewards';
import {
  getStatusRewards,
  isPendingTransactionHash,
  isSuccessfulTransaction,
  isTreatmentDurationExceeded,
  updateTxHash,
  updateUserOpHash,
} from './utils';

/**
 * Handles the referral reward process based on provided parameters.
 * @param params An object containing necessary parameters for handling the referral reward.
 * @param params.eventId The ID of the event.
 * @param params.userTelegramID The Telegram ID of the user.
 * @param params.responsePath The response path.
 * @param params.userHandle The user's handle.
 * @param params.userName The user's name.
 * @param params.patchwallet The user's patch wallet.
 * @param params.tokenAddress Optional: The token address.
 * @param params.chainName Optional: The chain name.
 * @returns A Promise that resolves to a boolean indicating the success status of the process.
 */
export async function handleReferralReward(params: {
  eventId: string;
  userTelegramID: string;
  responsePath: string;
  userHandle: string;
  userName: string;
  patchwallet: string;
  tokenAddress?: string;
  chainName?: string;
}): Promise<boolean> {
  try {
    const reward = await createReferralRewardTelegram(
      params.eventId,
      params.userTelegramID,
      params.responsePath,
      params.userHandle,
      params.userName,
      params.patchwallet,
      params.tokenAddress,
      params.chainName,
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
