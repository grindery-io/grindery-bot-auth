import { TRANSACTION_STATUS } from '../constants.js';
import { createReferralRewardTelegram } from '../rewards.js';

/**
 * Handles the referral reward for a user.
 *
 * @param {Object} db - The database object.
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} responsePath - The response path.
 * @param {string} userHandle - The user's handle.
 * @param {string} userName - The user's name.
 * @param {string} patchwallet - The user's Patchwallet.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleReferralReward(params) {
  try {
    const rewardTest = await createReferralRewardTelegram(
      params.eventId,
      params.userTelegramID,
      params.responsePath,
      params.userHandle,
      params.userName,
      params.patchwallet,
      params.tokenAddress,
      params.chainName
    );

    if (!(await rewardTest.setParentTx())) return true;
    if (!(await rewardTest.getReferent())) return true;

    await rewardTest.getRewardSameFromDatabase();

    if (
      rewardTest.isSuccess() ||
      (await rewardTest.getRewardFromDatabaseWithOtherEventId())
    ) {
      console.log(
        `[${eventId}] referral reward already distributed or in process of distribution elsewhere for ${rewardTest.referent.userTelegramID} concerning new user ${params.userTelegramID}`
      );
      return true;
    }

    await rewardTest.updateReferentWallet();

    if (!rewardTest.tx)
      await rewardTest.updateInDatabase(TRANSACTION_STATUS.PENDING, new Date());

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
          `[${params.eventId}] Error processing FlowXO webhook during referral reward: ${error}`
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
      `[${params.eventId}] Error processing referral reward event: ${error}`
    );
  }

  return true;
}

export const referral_utils = {
  handleReferralReward,
};
