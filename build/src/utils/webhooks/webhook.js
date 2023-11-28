"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNewReward = void 0;
const user_1 = require("../user");
const signup_reward_1 = require("./signup-reward");
const referral_reward_1 = require("./referral-reward");
const link_reward_1 = require("./link-reward");
/**
 * Handles the processing of a new reward for a user.
 *
 * @param {any} params - The parameters containing user and event details.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
async function handleNewReward(params) {
    const user = await (0, user_1.createUserTelegram)(params.userTelegramID, params.responsePath, params.userHandle, params.userName);
    if (user.isInDatabase) {
        // The user already exists, stop processing
        console.log(`[${params.eventId}] ${user.telegramID} user already exists.`);
        return true;
    }
    if (!user.patchwallet)
        return false;
    if (!(await signup_reward_1.signup_utils.handleSignUpReward({
        ...params,
        patchwallet: user.patchwallet,
    })))
        return false;
    if (!(await referral_reward_1.referral_utils.handleReferralReward({
        ...params,
        patchwallet: user.patchwallet,
    })))
        return false;
    if (params.referentUserTelegramID &&
        !(await link_reward_1.link_reward_utils.handleLinkReward(params.eventId, params.userTelegramID, params.referentUserTelegramID, params.tokenAddress, params.chainName)))
        return false;
    if (!(await user.isUserInDatabase())) {
        await user.saveToDatabase(params.eventId);
        await user.saveToSegment(params.eventId);
    }
    return true;
}
exports.handleNewReward = handleNewReward;
//# sourceMappingURL=webhook.js.map