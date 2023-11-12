import { Database } from '../db/conn.js';
import { BigQuery } from '@google-cloud/bigquery';
import { TRANSFERS_COLLECTION, USERS_COLLECTION } from '../utils/constants.js';
import web3 from 'web3';

const bigqueryClient = new BigQuery();
const datasetId = 'telegram';

const importUsers = async () => {
  const tableId = 'users';
  const db = await Database.getInstance();
  const collection = db.collection(USERS_COLLECTION);

  // Get all users from the database
  const allUsers = await collection.find({}).toArray();

  if (allUsers.length === 0) {
    console.log('No users found in MongoDB.');
    return;
  }

  const batchSize = 3000;
  let importedCount = 0;

  const existingPatchwallets = await getExistingPatchwallets(tableId);

  for (let i = 0; i < allUsers.length; i += batchSize) {
    console.log(
      `BIGQUERY - importedCount ${importedCount} i ${i} allUsers ${allUsers.length}`
    );
    const batch = allUsers.slice(i, i + batchSize);

    const filteredBatch = batch.filter((user) => {
      return !existingPatchwallets.includes(
        web3.utils.toChecksumAddress(user.patchwallet)
      );
    });

    if (filteredBatch.length === 0) {
      console.log('BIGQUERY All users in the batch already exist in BigQuery.');
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

async function getExistingPatchwallets(tableId) {
  const query = `SELECT patchwallet FROM ${datasetId}.${tableId}`;
  const [rows] = await bigqueryClient.query(query);

  return rows.map((row) => row.patchwallet);
}

const importTransfers = async () => {
  const tableId = 'transfer';
  const db = await Database.getInstance();
  const collection = db.collection(TRANSFERS_COLLECTION);

  const allTransfers = await collection.find({}).toArray();

  if (allTransfers.length === 0) {
    console.log('No transfers found in MongoDB.');
    return;
  }

  const batchSize = 10000;
  let insertedCount = 0;

  const existingTransactionHashes = await getExistingTransactionHashes(tableId);
  console.log('BIGQUERY - existingTransactionHashes');

  for (let i = 0; i < allTransfers.length; i += batchSize) {
    console.log(
      `BIGQUERY - insertedCount ${insertedCount} allTransfers ${allTransfers.length} i ${i}`
    );
    const batch = allTransfers.slice(i, i + batchSize);

    const filteredBatch = batch.filter((transfer) => {
      return !existingTransactionHashes.includes(transfer.transactionHash);
    });

    if (filteredBatch.length === 0) {
      console.log(
        'BIGQUERY All transfers in the batch already exist in BigQuery.'
      );
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
          tx_id: transfer.TxId,
          sender_handle: transfer.senderHandle,
          event_id: null,
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

async function getExistingTransactionHashes(tableId) {
  const query = `SELECT transaction_hash FROM ${datasetId}.${tableId}`;
  const [rows] = await bigqueryClient.query(query);

  return rows.map((row) => row.transaction_hash);
}
