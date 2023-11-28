"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referral_utils = exports.handleReferralReward = void 0;
const constants_1 = require("../constants");
const rewards_1 = require("../rewards");
/**
 * Handles the referral reward for a user.
 *
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} responsePath - The response path.
 * @param {string} userHandle - The user's handle.
 * @param {string} userName - The user's name.
 * @param {string} patchwallet - The user's Patchwallet.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
async function handleReferralReward(params) {
    try {
        const reward = await (0, rewards_1.createReferralRewardTelegram)(params.eventId, params.userTelegramID, params.responsePath, params.userHandle, params.userName, params.patchwallet, params.tokenAddress, params.chainName);
        if (!(await reward.setParentTx()))
            return true;
        if (!(await reward.getReferent()))
            return true;
        await reward.getRewardSameFromDatabase();
        if (reward.isSuccess() ||
            (await reward.getRewardFromDatabaseWithOtherEventId())) {
            console.log(`[${params.eventId}] referral reward already distributed or in process of distribution elsewhere for ${reward.referent.userTelegramID} concerning new user ${params.userTelegramID}`);
            return true;
        }
        await reward.updateReferentWallet();
        if (!reward.tx)
            await reward.updateInDatabase(constants_1.TRANSACTION_STATUS.PENDING, new Date());
        let txReward;
        // Handle pending hash status
        if (reward.isPendingHash()) {
            if (await reward.isTreatmentDurationExceeded())
                return true;
            // Check userOpHash and updateInDatabase for success
            if (!reward.userOpHash)
                return (await reward.updateInDatabase(constants_1.TRANSACTION_STATUS.SUCCESS, new Date()),
                    true);
            // Get status of reward test
            if ((txReward = await reward.getStatus()) === false)
                return txReward;
        }
        // Check for txReward and send transaction if not present
        if (!txReward && (txReward = await reward.sendTx()) === false)
            return txReward;
        // Update transaction hash and perform additional actions
        if (txReward && txReward.data.txHash) {
            reward.updateTxHash(txReward.data.txHash);
            await Promise.all([
                reward.updateInDatabase(constants_1.TRANSACTION_STATUS.SUCCESS, new Date()),
                reward.saveToFlowXO(),
            ]).catch((error) => console.error(`[${params.eventId}] Error processing FlowXO webhook during referral reward: ${error}`));
            return true;
        }
        // Update userOpHash if present in txReward
        if (txReward && txReward.data.userOpHash) {
            reward.updateUserOpHash(txReward.data.userOpHash);
            await reward.updateInDatabase(constants_1.TRANSACTION_STATUS.PENDING_HASH, null);
        }
        return false;
    }
    catch (error) {
        console.error(`[${params.eventId}] Error processing referral reward event: ${error}`);
    }
    return true;
}
exports.handleReferralReward = handleReferralReward;
exports.referral_utils = {
    handleReferralReward,
};
//# sourceMappingURL=referral-reward.js.map