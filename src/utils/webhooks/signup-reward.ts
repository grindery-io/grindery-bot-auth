import { TRANSACTION_STATUS } from '../constants';
import { SignUpRewardTelegram, createSignUpRewardTelegram } from '../rewards';
import { isPendingTransactionHash, isTreatmentDurationExceeded } from './utils';

/**
 * Handles the sign-up reward process based on provided parameters.
 * @param params An object containing necessary parameters for handling the sign-up reward.
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
export async function handleSignUpReward(params: {
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
    // Create a sign-up reward object
    let reward = await createSignUpRewardTelegram(
      params.eventId,
      params.userTelegramID,
      params.responsePath,
      params.userHandle,
      params.userName,
      params.patchwallet,
      params.tokenAddress,
      params.chainName,
    );

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
