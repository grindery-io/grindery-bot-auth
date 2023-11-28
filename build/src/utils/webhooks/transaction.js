"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleNewTransaction = void 0;
const conn_1 = require("../../db/conn");
const constants_1 = require("../constants");
const telegram_1 = require("../telegram");
const transfers_1 = require("../transfers");
/**
 * Handles a new transaction based on the provided parameters.
 *
 * @param {object} params - The transaction parameters.
 * @param {string} params.eventId - The event ID.
 * @param {string} params.senderTgId - The sender's Telegram ID.
 * @param {string} params.recipientTgId - The recipient's Telegram ID.
 * @param {number} params.amount - The transaction amount.
 * @param {string} params.message - The optional message to send via Telegram.
 * @returns {Promise<boolean>} - True if the transaction is successfully handled, false otherwise.
 */
async function handleNewTransaction(params) {
    // Establish a connection to the database
    const db = await conn_1.Database.getInstance();
    // Retrieve sender information from the "users" collection
    const senderInformation = await db
        .collection(constants_1.USERS_COLLECTION)
        .findOne({ userTelegramID: params.senderTgId });
    if (!senderInformation)
        return (console.error(`[${params.eventId}] Sender ${params.senderTgId} is not a user`),
            true);
    // Create a transfer object
    let transfer = await (0, transfers_1.createTransferTelegram)(params.eventId, senderInformation, params.recipientTgId, params.amount, params.chainId, params.tokenAddress, params.chainName);
    if (!transfer)
        return false;
    transfer = transfer;
    if (transfer.isSuccess() || transfer.isFailure())
        return true;
    let tx;
    // Handle pending hash status
    if (transfer.isPendingHash()) {
        if (await transfer.isTreatmentDurationExceeded())
            return true;
        // Check userOpHash and updateInDatabase for success
        if (!transfer.userOpHash)
            return (await transfer.updateInDatabase(constants_1.TRANSACTION_STATUS.SUCCESS, new Date()),
                true);
        // Check status for userOpHash
        if ((tx = await transfer.getStatus()) === true || tx == false)
            return tx;
    }
    // Handle sending transaction if not already handled
    if (!tx && ((tx = await transfer.sendTx()) === true || tx == false))
        return tx;
    // Finalize transaction handling
    if (tx && tx.data.txHash) {
        transfer.updateTxHash(tx.data.txHash);
        await Promise.all([
            transfer.updateInDatabase(constants_1.TRANSACTION_STATUS.SUCCESS, new Date()),
            transfer.saveToSegment(),
            transfer.saveToFlowXO(),
            params.message &&
                senderInformation.telegramSession &&
                (0, telegram_1.sendTelegramMessage)(params.message, params.recipientTgId, senderInformation).then((result) => result.success ||
                    console.error('Error sending telegram message:', result.message)),
        ]).catch((error) => console.error(`[${params.eventId}] Error processing Segment or FlowXO webhook, or sending telegram message: ${error}`));
        console.log(`[${transfer.txHash}] transaction from ${transfer.senderInformation.senderTgId} to ${transfer.recipientTgId} for ${transfer.amount} with event ID ${transfer.eventId} finished.`);
        return true;
    }
    // Handle pending hash for userOpHash
    tx &&
        tx.data.userOpHash &&
        transfer.updateUserOpHash(tx.data.userOpHash) &&
        (await transfer.updateInDatabase(constants_1.TRANSACTION_STATUS.PENDING_HASH, null));
    return false;
}
exports.handleNewTransaction = handleNewTransaction;
//# sourceMappingURL=transaction.js.map