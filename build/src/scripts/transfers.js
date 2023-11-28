"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
/* eslint-disable @typescript-eslint/no-unused-vars */
const conn_1 = require("../db/conn");
const fs_1 = tslib_1.__importDefault(require("fs"));
const csv_parser_1 = tslib_1.__importDefault(require("csv-parser"));
const web3_1 = tslib_1.__importDefault(require("web3"));
const constants_1 = require("../utils/constants");
const csv_writer_1 = require("csv-writer");
const secrets_1 = require("../../secrets");
// Example usage of the functions:
// removeDuplicateTransfers();
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
async function removeDuplicateTransfers() {
    try {
        const db = await conn_1.Database.getInstance();
        const collectionTransfers = db.collection(constants_1.TRANSFERS_COLLECTION);
        // Aggregation pipeline to identify duplicates and keep the first instance
        const aggregationPipeline = [
            {
                $group: {
                    _id: '$transactionHash',
                    firstInstance: { $first: '$_id' },
                },
            },
        ];
        // Find the first instance of each duplicate transactionHash
        const firstInstances = await collectionTransfers
            .aggregate(aggregationPipeline)
            .toArray();
        // Create an array of _id values to keep (first instances)
        const idsToKeep = firstInstances.map((instance) => instance.firstInstance);
        // Delete all documents that are not in the idsToKeep array
        const deleteResult = await collectionTransfers.deleteMany({
            _id: { $nin: idsToKeep },
        });
        console.log(`Deleted ${deleteResult.deletedCount} duplicate transfers.`);
    }
    catch (error) {
        console.error(`An error occurred: ${error.message}`);
    }
    finally {
        process.exit(0);
    }
}
// Usage: transfersCleanup(filePath)
// Description: This function processes transfers data from a CSV file and deletes incomplete transfers from the database.
// - filePath: The path to the CSV file containing transfers data.
// Example: transfersCleanup("dune.csv");
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
async function transfersCleanup(fileName) {
    const db = await conn_1.Database.getInstance();
    const collection = db.collection(constants_1.TRANSFERS_COLLECTION);
    const hashesInCsv = [];
    let latestTimestamp = null;
    fs_1.default.createReadStream(fileName)
        .pipe((0, csv_parser_1.default)())
        .on('data', (row) => {
        hashesInCsv.push(row.hash);
        const rowTimestamp = new Date(row.block_time);
        if (latestTimestamp === null || rowTimestamp > latestTimestamp) {
            latestTimestamp = rowTimestamp;
        }
    })
        .on('end', async () => {
        if (latestTimestamp === null) {
            console.log('No timestamp found in CSV.');
            process.exit(1);
        }
        const transfersInDb = await collection
            .find({
            dateAdded: { $lte: latestTimestamp },
        })
            .toArray();
        const hashesToDelete = transfersInDb
            .filter((transfer) => !hashesInCsv.includes(transfer.transactionHash))
            .map((transfer) => transfer.transactionHash);
        if (hashesToDelete.length === 0) {
            console.log('All transfers in database match the transfers in CSV.');
        }
        else {
            const deleteResult = await collection.deleteMany({
                transactionHash: { $in: hashesToDelete },
            });
            console.log(`${deleteResult.deletedCount} incomplete transfers deleted.`);
        }
        console.log('\n All tasks completed \n');
        process.exit(0);
    })
        .on('error', (error) => {
        console.log('\n Errors during CSV parsing \n', error);
        process.exit(1);
    });
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
async function updateTransfersInformations() {
    try {
        // Connect to the database
        const db = await conn_1.Database.getInstance();
        // Get the transfers collection
        const transfersCollection = db.collection(constants_1.TRANSFERS_COLLECTION);
        // Get the users collection
        const usersCollection = db.collection(constants_1.USERS_COLLECTION);
        // Find all transfers in the collection
        const allTransfers = await transfersCollection.find({}).toArray();
        const totalTransfers = allTransfers.length;
        const allUsers = await usersCollection.find({}).toArray();
        // Create an array to store bulk write operations
        const bulkWriteOperations = [];
        let index = 0;
        for (const transfer of allTransfers) {
            index++;
            // Update senderWallet and recipientWallet to checksum addresses
            transfer.senderWallet = web3_1.default.utils.toChecksumAddress(transfer.senderWallet);
            transfer.recipientWallet = web3_1.default.utils.toChecksumAddress(transfer.recipientWallet);
            // Find sender user based on senderWallet
            const senderUser = allUsers.find((user) => user.patchwallet === transfer.senderWallet);
            // Find recipient user based on recipientWallet
            const recipientUser = allUsers.find((user) => user.patchwallet === transfer.recipientWallet);
            if (senderUser) {
                // Fill senderTgId and senderName
                transfer.senderTgId = senderUser.userTelegramID;
                transfer.senderName = senderUser.userName;
            }
            if (recipientUser) {
                // Fill recipientTgId
                transfer.recipientTgId = recipientUser.userTelegramID;
            }
            // Create an update operation and add it to the bulk write array
            const updateOperation = {
                updateOne: {
                    filter: { _id: transfer._id },
                    update: { $set: transfer },
                },
            };
            bulkWriteOperations.push(updateOperation);
            console.log(`Updated transfer ${index}/${totalTransfers}: ${transfer._id}`);
        }
        // Perform bulk write operations
        await transfersCollection.bulkWrite(bulkWriteOperations);
        console.log('All transfers have been updated.');
    }
    catch (error) {
        console.error('An error occurred:', error);
    }
    finally {
        process.exit(0);
    }
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
async function removeRewardFromTransfers() {
    try {
        const db = await conn_1.Database.getInstance();
        const collectionTransfers = db.collection(constants_1.TRANSFERS_COLLECTION);
        const collectionRewards = db.collection(constants_1.REWARDS_COLLECTION);
        // Get all transaction hashes from the rewards collection
        const rewardHashes = await collectionRewards.distinct('transactionHash');
        const allTransfers = await collectionTransfers.find({}).toArray();
        const totalTransfers = allTransfers.length;
        const deletedTransfers = [];
        let index = 0;
        for (const transfer of allTransfers) {
            index++;
            // Check if the transactionHash exists in the rewardHashes array
            // and sender is SOURCE_TG_ID
            if (rewardHashes.includes(transfer.transactionHash) &&
                transfer.senderTgId == secrets_1.SOURCE_TG_ID) {
                // Delete the transfer
                await collectionTransfers.deleteOne({
                    _id: transfer._id,
                });
                deletedTransfers.push(transfer);
                console.log(`Deleted transfer ${index}/${totalTransfers}: ${transfer._id}`);
            }
        }
        console.log(`Total deleted transfers: ${deletedTransfers.length}`);
    }
    catch (error) {
        console.error(`An error occurred: ${error.message}`);
    }
    finally {
        process.exit(0);
    }
}
/**
 * Usage: checkMissingTransfers(filePath)
 * Description: This function processes transfer data from a CSV file and identifies the transfers in the database that aren't present in the CSV, excluding a specified address.
 * - filePath: The path to the CSV file containing transfer data.
 * Example: checkMissingTransfers("transfersData.csv");
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
async function checkMissingTransfers(fileName) {
    const db = await conn_1.Database.getInstance();
    const collection = db.collection(constants_1.TRANSFERS_COLLECTION);
    const hashesInCsv = new Set();
    const excludeAddress = secrets_1.SOURCE_WALLET_ADDRESS;
    fs_1.default.createReadStream(fileName)
        .pipe((0, csv_parser_1.default)())
        .on('data', (row) => {
        if (web3_1.default.utils.toChecksumAddress(row.from) !== excludeAddress) {
            hashesInCsv.add(row.hash);
        }
    })
        .on('end', async () => {
        const transfersHashesInDb = await collection.distinct('transactionHash');
        const hashesNotInDb = [...hashesInCsv].filter((hash) => !transfersHashesInDb.includes(hash));
        if (hashesNotInDb.length === 0) {
            console.log('All transfers in CSV are present in the MongoDB collection.');
        }
        else {
            console.log("The following transaction hashes from the CSV aren't present in MongoDB transfers collection:");
            console.log(hashesNotInDb.join('\n'));
            console.log(`Total Missing: ${hashesNotInDb.length}`);
        }
        process.exit(0);
    })
        .on('error', (error) => {
        console.error('Error during CSV parsing:', error);
        process.exit(1);
    });
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
async function getUsersFollowUps() {
    try {
        const db = await conn_1.Database.getInstance();
        const transfersCollection = db.collection(constants_1.TRANSFERS_COLLECTION);
        const usersCollection = db.collection(constants_1.USERS_COLLECTION);
        const allTransfers = await transfersCollection.find({}).toArray();
        const allUsers = await usersCollection.find({}).toArray();
        const senderTgIdToFollowup = {};
        const recipientTgIds = new Set(allUsers.map((user) => user.userTelegramID));
        for (const transfer of allTransfers) {
            const senderTgId = transfer.senderTgId;
            if (!senderTgId) {
                // Skip transfers without senderTgId
                continue;
            }
            // Check if the recipientTgId is not in the set of recipientTgIds
            if (!recipientTgIds.has(transfer.recipientTgId)) {
                // If the recipientTgId is not found in the users collection, increment the followup count for the senderTgId
                if (!senderTgIdToFollowup[senderTgId]) {
                    senderTgIdToFollowup[senderTgId] = {
                        count: 1,
                        userInfo: allUsers.find((user) => user.userTelegramID === senderTgId),
                    };
                }
                else {
                    senderTgIdToFollowup[senderTgId].count++;
                }
            }
        }
        // Create an array with senderTgId, followup count, and user info
        const senderTgIdInfoArray = [];
        for (const senderTgId in senderTgIdToFollowup) {
            senderTgIdInfoArray.push({
                userTelegramID: senderTgId,
                followupCount: senderTgIdToFollowup[senderTgId].count,
                userHandle: senderTgIdToFollowup[senderTgId].userInfo?.userHandle,
                userName: senderTgIdToFollowup[senderTgId].userInfo?.userName,
                responsePath: senderTgIdToFollowup[senderTgId].userInfo?.responsePath,
                patchwallet: senderTgIdToFollowup[senderTgId].userInfo?.patchwallet,
            });
        }
        // Create a CSV writer
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: 'sender_followup.csv',
            header: [
                { id: 'userTelegramID', title: 'User Telegram ID' },
                { id: 'followupCount', title: 'Followup Count' },
                { id: 'userHandle', title: 'User Handle' },
                { id: 'userName', title: 'User Name' },
                { id: 'responsePath', title: 'Response Path' },
                { id: 'patchwallet', title: 'Patchwallet' },
            ],
        });
        // Write the senderTgId information to a CSV file
        await csvWriter.writeRecords(senderTgIdInfoArray);
        console.log('CSV file created: sender_followup.csv');
    }
    catch (error) {
        console.error('An error occurred:', error);
    }
    finally {
        process.exit(0);
    }
}
/**
 * Asynchronous function to retrieve and export transactions statistics.
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
async function getDoubleTxs() {
    try {
        const db = await conn_1.Database.getInstance();
        const collection = db.collection(constants_1.TRANSFERS_COLLECTION);
        const csvWriter = (0, csv_writer_1.createObjectCsvWriter)({
            path: 'matched_transactions.csv',
            header: [
                { id: 'senderWallet', title: 'Sender Wallet' },
                { id: 'recipientWallet', title: 'Recipient Wallet' },
                { id: 'amount', title: 'Amount' },
                { id: 'numberOfTransactions', title: 'Number of Transactions' },
                { id: 'amountToRepay', title: 'Amount to Repay' },
            ],
        });
        // Define the date range
        const startDate = new Date('2023-10-13T09:00:00.000Z'); // Converted to UTC
        const endDate = new Date('2023-10-15T04:00:00.000Z'); // Converted to UTC
        // Filter transactions within the date range
        const transactions = await collection
            .find({
            dateAdded: {
                $gte: startDate,
                $lte: endDate,
            },
        })
            .toArray();
        // Create an object to store matching transactions
        const matchedTransactions = {};
        // Analyze the transactions
        transactions.forEach((transaction) => {
            if (transaction.transactionHash) {
                const key = `${transaction.senderWallet} - ${transaction.recipientWallet} - ${transaction.tokenAmount}`;
                if (!matchedTransactions[key]) {
                    matchedTransactions[key] = {
                        senderWallet: transaction.senderWallet,
                        recipientWallet: transaction.recipientWallet,
                        amount: parseInt(transaction.tokenAmount),
                        numberOfTransactions: 1,
                        amountToRepay: 0,
                    };
                }
                else {
                    matchedTransactions[key].numberOfTransactions += 1;
                    matchedTransactions[key].amountToRepay += parseInt(transaction.tokenAmount);
                }
                console.log(`Transaction ${transaction.transactionHash} done.`);
            }
        });
        // Filter elements where numberOfTransactions > 1
        const filteredTransactions = Object.values(matchedTransactions).filter((transaction) => transaction.numberOfTransactions > 1);
        // Export the filtered data to a CSV file
        await csvWriter.writeRecords(filteredTransactions);
        console.log('Exported matched transactions to matched_transactions.csv');
    }
    catch (error) {
        console.error('An error occurred:', error);
    }
    finally {
        process.exit(0);
    }
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
async function convertFieldsToString() {
    try {
        // Connect to the database
        const db = await conn_1.Database.getInstance();
        // Get the transfers collection
        const transfersCollection = db.collection(constants_1.TRANSFERS_COLLECTION);
        // Find documents where senderTgId, recipientTgId, or tokenAmount are numbers
        const numericDocuments = await transfersCollection
            .find({
            $or: [
                { senderTgId: { $type: 'number' } },
                { recipientTgId: { $type: 'number' } },
                { tokenAmount: { $type: 'number' } },
            ],
        })
            .toArray();
        console.log('numericDocuments', numericDocuments);
        // Create bulk write operations to update documents
        const bulkWriteOperations = numericDocuments.map((document) => {
            const updateOperation = {
                updateOne: {
                    filter: { _id: document._id },
                    update: {
                        $set: {
                            senderTgId: document.senderTgId
                                ? String(document.senderTgId)
                                : null,
                            recipientTgId: document.recipientTgId
                                ? String(document.recipientTgId)
                                : null,
                            tokenAmount: document.tokenAmount
                                ? String(document.tokenAmount)
                                : null,
                        },
                    },
                },
            };
            return updateOperation;
        });
        // Perform the bulk write operations
        const result = await transfersCollection.bulkWrite(bulkWriteOperations);
        console.log(`Updated ${result.modifiedCount} documents.`);
    }
    catch (error) {
        console.error('An error occurred:', error);
    }
    finally {
        process.exit(0);
    }
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
async function nullifyTgIds() {
    try {
        // Connect to the database
        const db = await conn_1.Database.getInstance();
        // Get the transfers collection
        const transfersCollection = db.collection(constants_1.TRANSFERS_COLLECTION);
        // Find documents where senderTgId, recipientTgId, or tokenAmount are numbers
        const numericDocuments = await transfersCollection
            .find({
            $or: [
                { senderTgId: 'null' },
                { recipientTgId: 'null' },
                { tokenAmount: 'null' },
            ],
        })
            .toArray();
        console.log('numericDocuments', numericDocuments);
        // Create bulk write operations to update documents
        const bulkWriteOperations = numericDocuments.map((document) => {
            const updateOperation = {
                updateOne: {
                    filter: { _id: document._id },
                    update: {
                        $set: {
                            senderTgId: document.senderTgId === 'null' ? null : document.senderTgId,
                            recipientTgId: document.recipientTgId === 'null'
                                ? null
                                : document.recipientTgId,
                            tokenAmount: document.tokenAmount === 'null' ? null : document.tokenAmount,
                        },
                    },
                },
            };
            return updateOperation;
        });
        // Perform the bulk write operations
        const result = await transfersCollection.bulkWrite(bulkWriteOperations);
        console.log(`Updated ${result.modifiedCount} documents.`);
    }
    catch (error) {
        console.error('An error occurred:', error);
    }
    finally {
        process.exit(0);
    }
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
async function updateTransfersStatus() {
    try {
        const db = await conn_1.Database.getInstance();
        const transfersCollection = db.collection(constants_1.TRANSFERS_COLLECTION);
        const transfersToUpdate = await transfersCollection
            .find({ status: { $exists: false } })
            .toArray();
        const bulkWriteOperations = [];
        for (const transfer of transfersToUpdate) {
            console.log('processing...');
            const updateOperation = {
                updateOne: {
                    filter: { _id: transfer._id },
                    update: { $set: { status: 'success' } },
                },
            };
            bulkWriteOperations.push(updateOperation);
        }
        console.log('finish processing');
        if (bulkWriteOperations.length > 0) {
            const result = await transfersCollection.bulkWrite(bulkWriteOperations);
            console.log(`Updated ${result.modifiedCount} transfers with status: success`);
        }
        else {
            console.log('No transfers to update.');
        }
    }
    catch (error) {
        console.error('An error occurred:', error);
    }
    finally {
        process.exit(0);
    }
}
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
async function importMissingTransferFromCSV(fileName) {
    const db = await conn_1.Database.getInstance();
    const collection = db.collection(constants_1.TRANSFERS_COLLECTION);
    const usersCollection = db.collection(constants_1.USERS_COLLECTION);
    const groups = new Map();
    const startDate = new Date('2023-11-07T00:00:00Z');
    const endDate = new Date('2023-11-07T23:59:59Z');
    if (!fs_1.default.existsSync(fileName)) {
        console.log(`File ${fileName} does not exist.`);
        process.exit(1);
    }
    const csvStream = fs_1.default.createReadStream(fileName).pipe((0, csv_parser_1.default)());
    csvStream.on('data', async (row) => {
        const blockTimestamp = new Date(row.block_timestamp);
        if (blockTimestamp >= startDate &&
            blockTimestamp <= endDate &&
            web3_1.default.utils.toChecksumAddress(row.from_address) !== secrets_1.SOURCE_WALLET_ADDRESS) {
            const key = `${row.from_address}-${row.to_address}-${row.value}-${row.transaction_hash}-${row.block_timestamp}`;
            groups.set(key, (groups.get(key) || 0) + 1);
        }
    });
    csvStream.on('end', async () => {
        const bulkOps = [];
        let i = 1;
        const insertedDocs = [];
        console.log('\nGroups quantity ', groups.size);
        const usersData = new Map();
        // Preload user data
        const usersCursor = await usersCollection.find({}).toArray();
        await usersCursor.forEach((user) => {
            usersData.set(web3_1.default.utils.toChecksumAddress(user.patchwallet), user);
        });
        for (const [key, count] of groups) {
            const [senderWallet, recipientWallet, tokenAmount, transactionHash, blockTimestamp,] = key.split('-');
            console.log('\nQuantity of groups in csv: ', groups.size, ' Group: ', i, ' Key: ', {
                senderWallet: web3_1.default.utils.toChecksumAddress(senderWallet),
                recipientWallet: web3_1.default.utils.toChecksumAddress(recipientWallet),
                tokenAmount: web3_1.default.utils.fromWei(tokenAmount, 'ether'),
                transactionHash,
            });
            const countInDB = await collection.countDocuments({
                senderWallet: web3_1.default.utils.toChecksumAddress(senderWallet),
                recipientWallet: web3_1.default.utils.toChecksumAddress(recipientWallet),
                tokenAmount: web3_1.default.utils.fromWei(tokenAmount, 'ether'),
                transactionHash,
            });
            console.log('countInDB ', countInDB);
            const missingCount = count - countInDB;
            if (missingCount > 0) {
                console.log('Insert key: ', key);
                for (let i = 0; i < missingCount; i++) {
                    insertedDocs.push(key);
                    const senderUser = usersData.get(web3_1.default.utils.toChecksumAddress(senderWallet));
                    const senderTgId = senderUser ? senderUser.userTelegramID : undefined;
                    const senderName = senderUser ? senderUser.userName : undefined;
                    const senderHandle = senderUser ? senderUser.userHandle : undefined;
                    const recipientUser = usersData.get(web3_1.default.utils.toChecksumAddress(recipientWallet));
                    const recipientTgId = recipientUser
                        ? recipientUser.userTelegramID
                        : undefined;
                    bulkOps.push({
                        insertOne: {
                            document: {
                                TxId: transactionHash.substring(1, 8),
                                chainId: 'eip155:137',
                                tokenSymbol: 'g1',
                                tokenAddress: secrets_1.SOURCE_WALLET_ADDRESS,
                                senderTgId: senderTgId ? senderTgId.toString() : undefined,
                                senderWallet: web3_1.default.utils.toChecksumAddress(senderWallet),
                                senderName: senderName,
                                recipientTgId: recipientTgId
                                    ? recipientTgId.toString()
                                    : undefined,
                                recipientWallet: web3_1.default.utils.toChecksumAddress(recipientWallet),
                                tokenAmount: web3_1.default.utils.fromWei(tokenAmount, 'ether'),
                                transactionHash: transactionHash,
                                dateAdded: new Date(blockTimestamp),
                                status: 'success',
                                senderHandle: senderHandle,
                            },
                        },
                    });
                }
            }
            i++;
        }
        if (bulkOps.length > 0) {
            const collectionMissingTransfer = db.collection('transfers-missing');
            await collectionMissingTransfer.bulkWrite(bulkOps, { ordered: true });
        }
        console.log('\nDocs inserted: ', insertedDocs);
        console.log('\nQuantity of docs inserted: ', insertedDocs.length);
        process.exit(0);
    });
    csvStream.on('error', (error) => {
        console.log('\nErrors during CSV parsing\n', error);
        process.exit(1);
    });
}
//# sourceMappingURL=transfers.js.map