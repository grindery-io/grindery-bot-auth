"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransferTelegram = exports.createTransferTelegram = exports.getRewardLinkTxsUser = exports.getRewardTxsUser = exports.getOutgoingTxsToNewUsers = exports.getOutgoingTxsUser = exports.getIncomingTxsUser = void 0;
const tslib_1 = require("tslib");
const conn_1 = require("../db/conn");
const constants_1 = require("./constants");
const patchwallet_1 = require("./patchwallet");
const segment_1 = require("./segment");
const axios_1 = tslib_1.__importDefault(require("axios"));
const secrets_1 = require("../../secrets");
async function getIncomingTxsUser(db, userId, start, limit) {
    return await Promise.all((await db
        .collection(constants_1.TRANSFERS_COLLECTION)
        .find({ recipientTgId: userId })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()).map(async (entry) => ({
        ...entry,
        dateAdded: formatDate(entry.dateAdded),
        senderUserHandle: (await db
            .collection(constants_1.USERS_COLLECTION)
            .findOne({ userTelegramID: entry.senderTgId }))?.userHandle || null,
    })));
}
exports.getIncomingTxsUser = getIncomingTxsUser;
async function getOutgoingTxsUser(db, userId, start, limit) {
    return await Promise.all((await db
        .collection(constants_1.TRANSFERS_COLLECTION)
        .find({ senderTgId: userId })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()).map(async (entry) => ({
        ...entry,
        dateAdded: formatDate(entry.dateAdded),
        recipientUserHandle: (await db
            .collection(constants_1.USERS_COLLECTION)
            .findOne({ userTelegramID: entry.recipientTgId }))?.userHandle || null,
    })));
}
exports.getOutgoingTxsUser = getOutgoingTxsUser;
async function getOutgoingTxsToNewUsers(db, userId, start, limit) {
    return await Promise.all((await db
        .collection(constants_1.TRANSFERS_COLLECTION)
        .aggregate([
        {
            $match: {
                senderTgId: userId,
                recipientTgId: { $ne: null },
            },
        },
        {
            $lookup: {
                from: 'users',
                localField: 'recipientTgId',
                foreignField: 'userTelegramID',
                as: 'user',
            },
        },
        {
            $match: {
                user: { $size: 0 },
            },
        },
        {
            $project: {
                user: 0,
            },
        },
        {
            $sort: {
                dateAdded: -1,
            },
        },
        {
            $skip: start,
        },
        ...(limit > 0
            ? [
                {
                    $limit: limit,
                },
            ]
            : []),
    ])
        .toArray()).map(async (entry) => ({
        ...entry,
        dateAdded: formatDate(entry.dateAdded),
    })));
}
exports.getOutgoingTxsToNewUsers = getOutgoingTxsToNewUsers;
async function getRewardTxsUser(db, userId, start, limit) {
    return (await db
        .collection(constants_1.REWARDS_COLLECTION)
        .find({ userTelegramID: userId })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()).map((entry) => ({
        ...entry,
        dateAdded: formatDate(entry.dateAdded),
    }));
}
exports.getRewardTxsUser = getRewardTxsUser;
async function getRewardLinkTxsUser(db, userId, start, limit) {
    return await Promise.all((await db
        .collection(constants_1.REWARDS_COLLECTION)
        .find({ userTelegramID: userId, reason: 'referral_link' })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()).map(async (entry) => ({
        ...entry,
        dateAdded: formatDate(entry.dateAdded),
        sponsoredUserHandle: (await db
            .collection(constants_1.USERS_COLLECTION)
            .findOne({ userTelegramID: entry.sponsoredUserTelegramID }))?.userHandle || null,
    })));
}
exports.getRewardLinkTxsUser = getRewardLinkTxsUser;
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
    });
}
/**
 * Creates a new transfer object and initializes it with the provided parameters.
 * @param {string} eventId - The event ID.
 * @param {object} senderInformation - Information about the sender.
 * @param {string} recipientTgId - The recipient's Telegram ID.
 * @param {number} amount - The transaction amount.
 * @returns {Promise<TransferTelegram|boolean>} - The initialized transfer object if successful, false otherwise.
 */
async function createTransferTelegram(eventId, senderInformation, recipientTgId, amount, chainId, tokenAddress, chainName) {
    const transfer = new TransferTelegram(eventId, senderInformation, recipientTgId, amount, chainId, tokenAddress, chainName);
    return (await transfer.initializeTransferDatabase()) && transfer;
}
exports.createTransferTelegram = createTransferTelegram;
/**
 * Represents a Telegram transfer.
 */
class TransferTelegram {
    eventId;
    senderInformation; // Change 'any' to the specific type as needed
    recipientTgId;
    amount;
    isInDatabase = false;
    tx;
    status;
    recipientWallet;
    txHash;
    userOpHash;
    db;
    chainId;
    tokenAddress;
    chainName;
    constructor(eventId, senderInformation, recipientTgId, amount, chainId, tokenAddress, chainName) {
        this.eventId = eventId;
        this.senderInformation = senderInformation;
        this.recipientTgId = recipientTgId;
        this.amount = amount.toString();
        this.isInDatabase = false;
        this.tx = undefined;
        this.status = undefined;
        this.recipientWallet = undefined;
        this.txHash = undefined;
        this.userOpHash = undefined;
        this.chainId = chainId ? chainId : 'eip155:137';
        this.tokenAddress = tokenAddress ? tokenAddress : secrets_1.G1_POLYGON_ADDRESS;
        this.chainName = chainName ? chainName : 'matic';
    }
    /**
     * Initializes the transfer object by connecting to the database and retrieving relevant information.
     * @returns {Promise<boolean>} - True if initialization is successful, false otherwise.
     */
    async initializeTransferDatabase() {
        this.db = await conn_1.Database.getInstance();
        this.tx = await this.getTransferFromDatabase();
        try {
            this.recipientWallet = await (0, patchwallet_1.getPatchWalletAddressFromTgId)(this.recipientTgId);
        }
        catch (error) {
            return false;
        }
        if (this.tx) {
            this.isInDatabase = true;
            this.status = this.tx.status;
            this.userOpHash = this.tx.userOpHash;
        }
        else {
            await this.updateInDatabase(constants_1.TRANSACTION_STATUS.PENDING, new Date());
        }
        return true;
    }
    /**
     * Retrieves the transfer information from the database.
     * @returns {Promise<object|null>} - The transfer information or null if not found.
     */
    async getTransferFromDatabase() {
        return await this.db
            .collection(constants_1.TRANSFERS_COLLECTION)
            .findOne({ eventId: this.eventId });
    }
    /**
     * Updates the transfer information in the database.
     * @param {string} status - The transaction status.
     * @param {Date|null} date - The date of the transaction.
     */
    async updateInDatabase(status, date) {
        await this.db.collection(constants_1.TRANSFERS_COLLECTION).updateOne({ eventId: this.eventId }, {
            $set: {
                eventId: this.eventId,
                chainId: this.chainId,
                tokenSymbol: 'g1',
                tokenAddress: this.tokenAddress,
                senderTgId: this.senderInformation.userTelegramID,
                senderWallet: this.senderInformation.patchwallet,
                senderName: this.senderInformation.userName,
                senderHandle: this.senderInformation.userHandle,
                recipientTgId: this.recipientTgId,
                recipientWallet: this.recipientWallet,
                tokenAmount: this.amount,
                status: status,
                ...(date !== null ? { dateAdded: date } : {}),
                transactionHash: this.txHash,
                userOpHash: this.userOpHash,
            },
        }, { upsert: true });
        console.log(`[${this.eventId}] transaction from ${this.senderInformation.userTelegramID} to ${this.recipientTgId} for ${this.amount} in MongoDB as ${status} with transaction hash : ${this.txHash}.`);
    }
    /**
     * Checks if the treatment duration has exceeded the limit.
     * @returns {Promise<boolean>} - True if the treatment duration has exceeded, false otherwise.
     */
    async isTreatmentDurationExceeded() {
        return ((this.tx.dateAdded < new Date(new Date().getTime() - 10 * 60 * 1000) &&
            (console.log(`[${this.eventId}] was stopped due to too long treatment duration (> 10 min).`),
                await this.updateInDatabase(constants_1.TRANSACTION_STATUS.FAILURE, new Date()),
                true)) ||
            false);
    }
    /**
     * Updates the transaction hash.
     * @param {string} txHash - The transaction hash to be updated.
     * @returns {string} - The updated transaction hash.
     */
    updateTxHash(txHash) {
        return (this.txHash = txHash);
    }
    /**
     * Updates the user operation hash.
     * @param {string} userOpHash - The user operation hash to be updated.
     * @returns {string} - The updated user operation hash.
     */
    updateUserOpHash(userOpHash) {
        return (this.userOpHash = userOpHash);
    }
    /**
     * Saves transaction information to the Segment.
     * @returns {Promise<void>} - The result of adding the transaction to the Segment.
     */
    async saveToSegment() {
        // Add transaction information to the Segment
        await (0, segment_1.addTrackSegment)({
            userTelegramID: this.senderInformation.userTelegramID,
            senderTgId: this.senderInformation.userTelegramID,
            senderWallet: this.senderInformation.patchwallet,
            senderName: this.senderInformation.userName,
            senderHandle: this.senderInformation.userHandle,
            recipientTgId: this.recipientTgId,
            recipientWallet: this.recipientWallet,
            tokenAmount: this.amount,
            transactionHash: this.txHash,
            dateAdded: new Date(),
            eventId: this.eventId,
        });
    }
    /**
     * Saves transaction information to FlowXO.
     * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
     */
    async saveToFlowXO() {
        // Send transaction information to FlowXO
        await axios_1.default.post(secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK, {
            senderResponsePath: this.senderInformation.responsePath,
            chainId: this.chainId,
            tokenSymbol: 'g1',
            tokenAddress: this.tokenAddress,
            senderTgId: this.senderInformation.userTelegramID,
            senderWallet: this.senderInformation.patchwallet,
            senderName: this.senderInformation.userName,
            senderHandle: this.senderInformation.userHandle,
            recipientTgId: this.recipientTgId,
            recipientWallet: this.recipientWallet,
            tokenAmount: this.amount,
            transactionHash: this.txHash,
            dateAdded: new Date(),
        });
    }
    /**
     * Checks if the transaction is successful.
     * @returns {boolean} - True if the transaction is successful, false otherwise.
     */
    isSuccess() {
        return this.status === constants_1.TRANSACTION_STATUS.SUCCESS;
    }
    /**
     * Checks if the transaction has failed.
     * @returns {boolean} - True if the transaction has failed, false otherwise.
     */
    isFailure() {
        return this.status === constants_1.TRANSACTION_STATUS.FAILURE;
    }
    /**
     * Checks if the transaction is in the pending hash state.
     * @returns {boolean} - True if the transaction is in the pending hash state, false otherwise.
     */
    isPendingHash() {
        return this.status === constants_1.TRANSACTION_STATUS.PENDING_HASH;
    }
    /**
     * Retrieves the status of the PatchWallet transaction.
     * @returns {Promise<any>} - True if the transaction status is retrieved successfully, false otherwise.
     */
    async getStatus() {
        try {
            // Retrieve the status of the PatchWallet transaction
            return await (0, patchwallet_1.getTxStatus)(this.userOpHash);
        }
        catch (error) {
            // Log error if retrieving transaction status fails
            console.error(`[${this.eventId}] Error processing PatchWallet transaction status: ${error}`);
            // Return true if the error status is 470, marking the transaction as failed
            return ((error?.response?.status === 470 &&
                (await this.updateInDatabase(constants_1.TRANSACTION_STATUS.FAILURE, new Date()),
                    true)) ||
                false);
        }
    }
    /**
     * Sends tokens using PatchWallet.
     * @returns {Promise<any>} - True if the tokens are sent successfully, false otherwise.
     */
    async sendTx() {
        try {
            // Send tokens using PatchWallet
            return await (0, patchwallet_1.sendTokens)(this.senderInformation.userTelegramID, this.recipientWallet, this.amount, await (0, patchwallet_1.getPatchWalletAccessToken)(), this.tokenAddress, this.chainName);
        }
        catch (error) {
            // Log error if sending tokens fails
            console.error(`[${this.eventId}] transaction from ${this.senderInformation.userTelegramID} to ${this.recipientTgId} for ${this.amount} - Error processing PatchWallet token sending: ${error}`);
            // Return true if the amount is not a valid number or the error status is 470, marking the transaction as failed
            return !/^\d+$/.test(this.amount) || error?.response?.status === 470
                ? (console.warn(`Potentially invalid amount: ${this.amount}, dropping`),
                    await this.updateInDatabase(constants_1.TRANSACTION_STATUS.FAILURE, new Date()),
                    true)
                : false;
        }
    }
}
exports.TransferTelegram = TransferTelegram;
//# sourceMappingURL=transfers.js.map