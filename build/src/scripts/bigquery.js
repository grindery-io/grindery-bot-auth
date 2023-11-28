"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importTransfersLast24Hours = exports.importUsersLast24Hours = void 0;
const tslib_1 = require("tslib");
/* eslint-disable @typescript-eslint/no-unused-vars */
const conn_1 = require("../db/conn");
const bigquery_1 = require("@google-cloud/bigquery");
const constants_1 = require("../utils/constants");
const web3_1 = tslib_1.__importDefault(require("web3"));
const bigqueryClient = new bigquery_1.BigQuery();
const datasetId = 'telegram';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
const importUsers = async () => {
    const tableId = 'users';
    const db = await conn_1.Database.getInstance();
    const collection = db.collection(constants_1.USERS_COLLECTION);
    // Get all users from the database
    const allUsers = await collection.find({}).toArray();
    if (allUsers.length === 0) {
        console.log('BIGQUERY - No users found in MongoDB.');
        return;
    }
    const batchSize = 3000;
    let importedCount = 0;
    const existingPatchwallets = await getExistingPatchwallets(tableId);
    for (let i = 0; i < allUsers.length; i += batchSize) {
        console.log(`BIGQUERY - importedCount ${importedCount} i ${i} allUsers ${allUsers.length}`);
        const batch = allUsers.slice(i, i + batchSize);
        const filteredBatch = batch.filter((user) => {
            return !existingPatchwallets.includes(web3_1.default.utils.toChecksumAddress(user.patchwallet));
        });
        if (filteredBatch.length === 0) {
            console.log('BIGQUERY - All users in the batch already exist in BigQuery.');
            continue;
        }
        if (filteredBatch.length !== 0) {
            const bigQueryData = filteredBatch.map((user) => {
                return {
                    context_ip: null,
                    id: user._id.toString(),
                    context_library_name: null,
                    context_library_version: null,
                    email: null,
                    industry: null,
                    loaded_at: null,
                    name: user.userName,
                    received_at: new Date(),
                    uuid_ts: new Date(user.dateAdded),
                    user_name: user.userName,
                    user_telegram_id: user.userTelegramID,
                    patchwallet: user.patchwallet,
                    response_path: user.responsePath,
                    user_handle: user.userHandle,
                };
            });
            await bigqueryClient
                .dataset(datasetId)
                .table(tableId)
                .insert(bigQueryData);
        }
        importedCount += filteredBatch.length;
    }
    process.exit(0);
};
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
const importTransfers = async () => {
    const tableId = 'transfer';
    const db = await conn_1.Database.getInstance();
    const collection = db.collection(constants_1.TRANSFERS_COLLECTION);
    const allTransfers = await collection.find({}).toArray();
    if (allTransfers.length === 0) {
        console.log('BIGQUERY - No transfers found in MongoDB.');
        return;
    }
    const batchSize = 10000;
    let insertedCount = 0;
    const existingTransactionHashes = await getExistingTransactionHashes(tableId);
    console.log('BIGQUERY - existingTransactionHashes');
    for (let i = 0; i < allTransfers.length; i += batchSize) {
        console.log(`BIGQUERY - insertedCount ${insertedCount} allTransfers ${allTransfers.length} i ${i}`);
        const batch = allTransfers.slice(i, i + batchSize);
        const filteredBatch = batch.filter((transfer) => {
            return !existingTransactionHashes.includes(transfer.transactionHash);
        });
        if (filteredBatch.length === 0) {
            console.log('BIGQUERY All transfers in the batch already exist in BigQuery.');
            continue;
        }
        if (filteredBatch.length !== 0) {
            const bigQueryData = filteredBatch.map((transfer) => {
                return {
                    amount: transfer.tokenAmount,
                    context_library_name: null,
                    context_library_version: null,
                    event: null,
                    event_text: null,
                    id: transfer._id.toString(),
                    loaded_at: null,
                    original_timestamp: null,
                    received_at: new Date(),
                    sent_at: null,
                    timestamp: new Date(transfer.dateAdded),
                    user_id: null,
                    uuid_ts: null,
                    chain_id: transfer.chainId,
                    recipient_tg_id: transfer.recipientTgId,
                    recipient_wallet: transfer.recipientWallet,
                    sender_name: transfer.senderName,
                    sender_tg_id: transfer.senderTgId,
                    sender_wallet: transfer.senderWallet,
                    token_address: transfer.tokenAddress,
                    token_amount: transfer.tokenAmount,
                    token_symbol: transfer.tokenSymbol,
                    transaction_hash: transfer.transactionHash,
                    sender_handle: transfer.senderHandle,
                    event_id: transfer.eventId,
                };
            });
            await bigqueryClient
                .dataset(datasetId)
                .table(tableId)
                .insert(bigQueryData);
        }
        insertedCount += filteredBatch.length;
    }
    process.exit(0);
};
const importUsersLast24Hours = async () => {
    const tableId = 'users';
    const db = await conn_1.Database.getInstance();
    const collection = db.collection(constants_1.USERS_COLLECTION);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - 24);
    const recentUsers = await collection
        .find({ dateAdded: { $gte: startDate, $lte: endDate } })
        .toArray();
    if (recentUsers.length === 0) {
        console.log('BIGQUERY - No users found in MongoDB in the last 24 hours.');
        return;
    }
    const batchSize = 3000;
    let importedCount = 0;
    const existingPatchwallets = await getExistingPatchwallets(tableId);
    for (let i = 0; i < recentUsers.length; i += batchSize) {
        console.log(`BIGQUERY - importedCount ${importedCount} i ${i} recentUsers ${recentUsers.length}`);
        const batch = recentUsers.slice(i, i + batchSize);
        const filteredBatch = batch.filter((user) => {
            return !existingPatchwallets.includes(web3_1.default.utils.toChecksumAddress(user.patchwallet));
        });
        if (filteredBatch.length === 0) {
            console.log('BIGQUERY - All users in the batch already exist in BigQuery.');
            continue;
        }
        const bigQueryData = filteredBatch.map((user) => {
            return {
                context_ip: null,
                id: user._id.toString(),
                context_library_name: null,
                context_library_version: null,
                email: null,
                industry: null,
                loaded_at: null,
                name: user.userName,
                received_at: new Date(),
                uuid_ts: new Date(user.dateAdded),
                user_name: user.userName,
                user_telegram_id: user.userTelegramID,
                patchwallet: user.patchwallet,
                response_path: user.responsePath,
                user_handle: user.userHandle,
            };
        });
        await bigqueryClient.dataset(datasetId).table(tableId).insert(bigQueryData);
        importedCount += filteredBatch.length;
    }
    process.exit(0);
};
exports.importUsersLast24Hours = importUsersLast24Hours;
const importTransfersLast24Hours = async () => {
    const tableId = 'transfer';
    const db = await conn_1.Database.getInstance();
    const collection = db.collection(constants_1.TRANSFERS_COLLECTION);
    // Calculate the date 24 hours ago
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - 24);
    // Find transfers in the last 24 hours
    const allTransfers = await collection
        .find({ dateAdded: { $gte: startDate } })
        .toArray();
    if (allTransfers.length === 0) {
        console.log('BIGQUERY - No transfers found in the last 24 hours in MongoDB.');
        return;
    }
    const batchSize = 10000;
    let insertedCount = 0;
    const existingTransactionHashes = await getExistingTransactionHashes(tableId);
    console.log('BIGQUERY - existingTransactionHashes');
    for (let i = 0; i < allTransfers.length; i += batchSize) {
        console.log(`BIGQUERY - insertedCount ${insertedCount} allTransfers ${allTransfers.length} i ${i}`);
        const batch = allTransfers.slice(i, i + batchSize);
        const filteredBatch = batch.filter((transfer) => {
            return !existingTransactionHashes.includes(transfer.transactionHash);
        });
        if (filteredBatch.length === 0) {
            console.log('BIGQUERY All transfers in the batch already exist in BigQuery.');
            continue;
        }
        if (filteredBatch.length !== 0) {
            const bigQueryData = filteredBatch.map((transfer) => {
                return {
                    amount: transfer.tokenAmount,
                    context_library_name: null,
                    context_library_version: null,
                    event_id: transfer.eventId,
                    event_text: null,
                    id: transfer._id.toString(),
                    loaded_at: null,
                    original_timestamp: null,
                    received_at: new Date(),
                    sent_at: null,
                    timestamp: new Date(transfer.dateAdded),
                    user_id: null,
                    uuid_ts: null,
                    chain_id: transfer.chainId,
                    recipient_tg_id: transfer.recipientTgId,
                    recipient_wallet: transfer.recipientWallet,
                    sender_name: transfer.senderName,
                    sender_tg_id: transfer.senderTgId,
                    sender_wallet: transfer.senderWallet,
                    token_address: transfer.tokenAddress,
                    token_amount: transfer.tokenAmount,
                    token_symbol: transfer.tokenSymbol,
                    transaction_hash: transfer.transactionHash,
                    sender_handle: transfer.senderHandle,
                };
            });
            await bigqueryClient
                .dataset(datasetId)
                .table(tableId)
                .insert(bigQueryData);
        }
        insertedCount += filteredBatch.length;
    }
    process.exit(0);
};
exports.importTransfersLast24Hours = importTransfersLast24Hours;
async function getExistingPatchwallets(tableId) {
    const query = `SELECT patchwallet FROM ${datasetId}.${tableId}`;
    const [rows] = await bigqueryClient.query(query);
    return rows.map((row) => web3_1.default.utils.toChecksumAddress(row.patchwallet));
}
async function getExistingTransactionHashes(tableId) {
    const query = `SELECT transaction_hash FROM ${datasetId}.${tableId}`;
    const [rows] = await bigqueryClient.query(query);
    return rows.map((row) => row.transaction_hash);
}
//# sourceMappingURL=bigquery.js.map