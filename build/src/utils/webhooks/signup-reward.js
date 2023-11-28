"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signup_utils = exports.handleSignUpReward = void 0;
const constants_1 = require("../constants");
const rewards_1 = require("../rewards");
/**
 * Handles the signup reward for a user.
 *
 * @param {Object} db - The database object.
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} responsePath - The response path.
 * @param {string} userHandle - The user's handle.
 * @param {string} userName - The user's name.
 * @param {string} rewardWallet - The wallet for the reward.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
async function handleSignUpReward(params) {
    try {
        // Create a sign-up reward object
        let reward = await (0, rewards_1.createSignUpRewardTelegram)(params.eventId, params.userTelegramID, params.responsePath, params.userHandle, params.userName, params.patchwallet, params.tokenAddress, params.chainName);
        // If reward already exists, return true
        if (!reward)
            return true;
        reward = reward;
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
            ]).catch((error) => console.error(`[${params.eventId}] Error processing FlowXO webhook during sign up reward: ${error}`));
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
        // Handle error
        console.error(`[${params.eventId}] Error processing sign up reward event: ${error}`);
    }
    return true;
}
exports.handleSignUpReward = handleSignUpReward;
exports.signup_utils = {
    handleSignUpReward,
};
//# sourceMappingURL=signup-reward.js.map