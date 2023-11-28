"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserTelegram = exports.createUserTelegram = void 0;
const conn_1 = require("../db/conn");
const constants_1 = require("./constants");
const patchwallet_1 = require("./patchwallet");
const segment_1 = require("./segment");
/**
 * Creates a new UserTelegram instance and initializes it.
 * @param {string} telegramID - The Telegram user ID.
 * @param {string} responsePath - The response path.
 * @param {string} userHandle - The user's handle.
 * @param {string} userName - The user's name.
 * @returns {Promise<UserTelegram>} - The initialized UserTelegram instance.
 */
async function createUserTelegram(telegramID, responsePath, userHandle, userName) {
    const user = new UserTelegram(telegramID, responsePath, userHandle, userName);
    await user.initializeUserDatabase();
    return user;
}
exports.createUserTelegram = createUserTelegram;
/**
 * Represents a UserTelegram.
 */
class UserTelegram {
    telegramID;
    responsePath;
    patchwallet;
    userHandle;
    userName;
    isInDatabase = false;
    db;
    constructor(telegramID, responsePath, userHandle, userName) {
        this.telegramID = telegramID;
        this.responsePath = responsePath;
        this.patchwallet = undefined;
        this.userHandle = userHandle;
        this.userName = userName;
        this.isInDatabase = false;
    }
    /**
     * Initializes the UserTelegram's database connection and retrieves user data if available.
     */
    async initializeUserDatabase() {
        this.db = await conn_1.Database.getInstance();
        const userDB = await this.getUserFromDatabase();
        if (userDB) {
            this.isInDatabase = true;
            this.patchwallet = userDB.patchwallet;
        }
        else {
            try {
                this.patchwallet = await (0, patchwallet_1.getPatchWalletAddressFromTgId)(this.telegramID);
            }
            catch (error) {
                console.error('Error:', error);
            }
        }
    }
    /**
     * Retrieves user data from the database.
     * @returns {Promise<Object>} - The user data from the database.
     */
    async getUserFromDatabase() {
        return await this.db
            .collection(constants_1.USERS_COLLECTION)
            .findOne({ userTelegramID: this.telegramID });
    }
    /**
     * Checks if the user is in the database.
     * @returns {Promise<boolean>} - `true` if the user is in the database, `false` otherwise.
     */
    async isUserInDatabase() {
        this.isInDatabase = !!(await this.getUserFromDatabase());
        return this.isInDatabase;
    }
    /**
     * Saves user data to the database.
     * @param {string} eventId - The event identifier.
     * @returns {Promise<Object|undefined>} - The result of the database operation or `undefined` if the user is already in the database.
     */
    async saveToDatabase(eventId) {
        if (this.isInDatabase)
            return undefined;
        const user = await this.db.collection(constants_1.USERS_COLLECTION).updateOne({ userTelegramID: this.telegramID }, {
            $set: {
                userTelegramID: this.telegramID,
                userHandle: this.userHandle,
                userName: this.userName,
                responsePath: this.responsePath,
                patchwallet: this.patchwallet,
                dateAdded: new Date(),
            },
        }, { upsert: true });
        console.log(`[${eventId}] ${this.telegramID} added to the user database.`);
        return user;
    }
    /**
     * Saves user data to a segmentation system.
     * @param {string} eventId - The event identifier.
     * @returns {Promise<Object|undefined>} - The result of the operation or `undefined` if the user is already in the database.
     */
    async saveToSegment(eventId) {
        if (this.isInDatabase)
            return undefined;
        try {
            const identitySegment = await (0, segment_1.addIdentitySegment)({
                userTelegramID: this.telegramID,
                responsePath: this.responsePath,
                userHandle: this.userHandle,
                userName: this.userName,
                patchwallet: this.patchwallet,
                dateAdded: new Date(),
            });
            console.log(`[${eventId}] ${this.telegramID} added to Segment.`);
            return identitySegment;
        }
        catch (error) {
            console.error(`[${eventId}] Error processing new user in Segment: ${error}`);
        }
        return undefined;
    }
    /**
     * Retrieves the sign-up rewards for the user.
     * @returns {Promise<Array>} - An array of sign-up rewards.
     */
    async getSignUpReward() {
        return await this.db
            .collection(constants_1.REWARDS_COLLECTION)
            .find({ userTelegramID: this.telegramID, reason: 'user_sign_up' })
            .toArray();
    }
    /**
     * Checks if the user has sign-up rewards.
     * @returns {Promise<boolean>} - `true` if the user has sign-up rewards, `false` otherwise.
     */
    async HasSignUpReward() {
        return (await this.getSignUpReward()).length > 0;
    }
    /**
     * Retrieves referral rewards for the user.
     * @returns {Promise<Array>} - An array of referral rewards.
     */
    async getReferralRewards() {
        return await this.db
            .collection(constants_1.REWARDS_COLLECTION)
            .find({ userTelegramID: this.telegramID, reason: '2x_reward' })
            .toArray();
    }
    /**
     * Retrieves the number of referral rewards for the user.
     * @returns {Promise<number>} - The number of referral rewards.
     */
    async getNbrReferralRewards() {
        return (await this.getReferralRewards()).length;
    }
    /**
     * Retrieves link rewards for the user.
     * @returns {Promise<Array>} - An array of link rewards.
     */
    async getLinkRewards() {
        return await this.db
            .collection(constants_1.REWARDS_COLLECTION)
            .find({ userTelegramID: this.telegramID, reason: 'referral_link' })
            .toArray();
    }
    /**
     * Retrieves the number of link rewards for the user.
     * @returns {Promise<number>} - The number of link rewards.
     */
    async getNbrLinkRewards() {
        return (await this.getLinkRewards()).length;
    }
}
exports.UserTelegram = UserTelegram;
//# sourceMappingURL=user.js.map