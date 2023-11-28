"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.link_reward_utils = exports.handleLinkReward = void 0;
const secrets_1 = require("../../../secrets");
const constants_1 = require("../constants");
const rewards_1 = require("../rewards");
/**
 * Handles the referral link reward for a user.
 *
 * @param {Object} db - The database object.
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} referentUserTelegramID - The Telegram ID of the referent user.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
async function handleLinkReward(eventId, userTelegramID, referentUserTelegramID, tokenAddress = secrets_1.G1_POLYGON_ADDRESS, chainName = 'matic') {
    try {
        let reward = await (0, rewards_1.createLinkRewardTelegram)(eventId, userTelegramID, referentUserTelegramID, tokenAddress, chainName);
        if (reward == false)
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
        if (txReward && txReward.data.txHash) {
            reward.updateTxHash(txReward.data.txHash);
            await Promise.all([
                reward.updateInDatabase(constants_1.TRANSACTION_STATUS.SUCCESS, new Date()),
                reward.saveToFlowXO(),
            ]).catch((error) => console.error(`[${eventId}] Error processing FlowXO webhook during sign up reward: ${error}`));
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
        console.error(`[${eventId}] Error processing link reward event: ${error}`);
    }
    return true;
}
exports.handleLinkReward = handleLinkReward;
exports.link_reward_utils = {
    handleLinkReward,
};
//# sourceMappingURL=link-reward.js.map