import { Database } from '../db/conn.js';
import { getPatchWalletAccessToken, sendTokens } from '../utils/patchwallet.js';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import fs from 'fs';
import csv from 'csv-parser';
import web3 from 'web3';
import {
  REWARDS_COLLECTION,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from '../utils/constants.js';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { SOURCE_TG_ID, SOURCE_WALLET_ADDRESS } from '../../secrets.js';

/**
 * Distributes a sign-up reward of 100 Grindery One Tokens to users without previous rewards.
 * Renewal of Patch Wallet access token is handled.
 */
async function distributeSignupRewards() {
  try {
    // Connect to the database
    const db = await Database.getInstance();
    const rewardsCollection = db.collection(REWARDS_COLLECTION);

    // Obtain the initial PatchWallet access token
    let patchWalletAccessToken = await getPatchWalletAccessToken();

    // Track the time of the last token renewal
    let lastTokenRenewalTime = Date.now();

    const allUsers = await db
      .collection(USERS_COLLECTION)
      .find({
        dateAdded: { $gt: new Date('2023-11-15T12:00:00Z').toISOString() },
      })
      .toArray();

    let userCount = 0;

    // Load all rewards into memory for filtering
    const allRewards = await rewardsCollection
      .find({
        reason: 'user_sign_up',
        status: 'success',
        dateAdded: { $gt: new Date('2023-11-10T12:00:00Z').toISOString() },
      })
      .toArray();

    for (const user of allUsers) {
      userCount++;

      // Check if there are no rewards for the current user
      if (
        !allRewards.some(
          (reward) => reward.userTelegramID === user.userTelegramID
        )
      ) {
        console.log(
          `[${userCount}/${allUsers.length}] User ${user.userTelegramID} has no sign up reward`
        );

        // Check if it's time to renew the PatchWallet access token
        if (Date.now() - lastTokenRenewalTime >= 50 * 60 * 1000) {
          patchWalletAccessToken = await getPatchWalletAccessToken();
          lastTokenRenewalTime = Date.now();

          console.log('PatchWallet access token has been updated.');
        }

        try {
          // Send the sign-up reward to the user's wallet
          const txReward = await sendTokens(
            SOURCE_TG_ID, // Sender's Telegram ID
            user.patchwallet, // User's wallet address
            '100', // Amount of the reward
            patchWalletAccessToken // Access token for PatchWallet API
          );

          if (txReward.data.txHash) {
            // Log the issuance of the reward and insert the record into the rewards collection
            await rewardsCollection.insertOne({
              userTelegramID: user.userTelegramID,
              responsePath: user.responsePath,
              walletAddress: user.patchwallet,
              reason: 'user_sign_up',
              userHandle: user.userHandle,
              userName: user.userName,
              amount: '100',
              message: 'Sign up reward',
              transactionHash: txReward.data.txHash,
              userOpHash: txReward.data.userOpHash,
              dateAdded: new Date(Date.now()),
              status: 'success',
              eventId: uuidv4(),
            });

            console.log(
              `[${userCount}/${allUsers.length}] User ${user.userTelegramID} has been rewarded for signing up.`
            );
          }
        } catch (error) {
          // Handle errors and log them
          console.error('An error occurred during reward distribution:', error);
        }
      }
    }

    // Log completion message
    console.log('All sign-up rewards have been distributed.');
  } catch (error) {
    // Handle errors and log them
    console.error('An error occurred:', error);
  } finally {
    // Exit the script
    process.exit(0);
  }
}

distributeSignupRewards();

export async function distributeReferralRewards() {
  try {
    // Connect to the database
    const db = await Database.getInstance();
    const rewardsCollection = db.collection(REWARDS_COLLECTION);

    // Obtain the initial PatchWallet access token
    let patchWalletAccessToken = await getPatchWalletAccessToken();

    // Track the time of the last token renewal
    let lastTokenRenewalTime = Date.now();

    // Create an array to store rewarded users
    const rewardedUsers = [];

    // Export the users and rewards collections as arrays
    const allUsers = await db.collection(USERS_COLLECTION).find({}).toArray();
    const allRewardsReferral = await rewardsCollection
      .find({ reason: '2x_reward' })
      .toArray();
    const allTransfers = await db
      .collection(TRANSFERS_COLLECTION)
      .find({})
      .toArray();

    let transferCount = 0;

    for (const transfer of allTransfers) {
      transferCount++;

      // Find the recipient user based on their Telegram ID
      const recipientUser = allUsers.find(
        (user) => user.userTelegramID === transfer.recipientTgId
      );

      // Check if the recipient user became a user before or after the transfer
      if (
        !recipientUser ||
        (recipientUser &&
          new Date(recipientUser.dateAdded) < new Date(transfer.dateAdded))
      ) {
        // The user was already a user before the transfer, so no action needed
        continue;
      }

      // Check if a reward for this transfer has already been issued
      if (
        allRewardsReferral.some(
          (reward) => reward.parentTransactionHash === transfer.TxId
        )
      ) {
        // A reward has already been issued for this transfer, so skip to the next one
        continue;
      }

      // Check if it's time to renew the PatchWallet access token
      if (Date.now() - lastTokenRenewalTime >= 50 * 60 * 1000) {
        patchWalletAccessToken = await getPatchWalletAccessToken();
        lastTokenRenewalTime = Date.now();
        console.log('PatchWallet access token has been updated.');
      }

      // Find information about the sender of the transaction
      const senderUser = allUsers.find(
        (user) =>
          user.userTelegramID === transfer.senderTgId &&
          transfer.senderTgId !== SOURCE_TG_ID
      );

      if (senderUser) {
        try {
          console.log(
            `[${transferCount}/${allTransfers.length}] User ${senderUser.userTelegramID} has no referral reward for sending ${transfer.tokenAmount} tokens to ${transfer.recipientTgId}`
          );
          // Get the sender's wallet address based on their Telegram ID if not already existing
          const rewardWallet =
            senderUser.patchwallet ??
            (await getPatchWalletAddressFromTgId(transfer.senderTgId));

          // Determine the reward amount based on the date and transfer amount
          let rewardAmount =
            new Date(transfer.dateAdded) < new Date('2023-09-07T12:00:00Z') &&
            Number(transfer.tokenAmount) < 1000
              ? (Number(transfer.tokenAmount) * 2).toString()
              : '50';

          let rewardMessage =
            new Date(transfer.dateAdded) < new Date('2023-09-07T12:00:00Z') &&
            Number(transfer.tokenAmount) < 1000
              ? '2x Referral reward'
              : 'Referral reward';

          // Send a reward of 50 tokens using the Patch Wallet API
          const txReward = await sendTokens(
            SOURCE_TG_ID,
            rewardWallet,
            Number(rewardAmount).toFixed(18),
            patchWalletAccessToken
          );

          // Log the issuance of the reward and insert the record into the rewards collection
          await rewardsCollection.insertOne({
            userTelegramID: senderUser.userTelegramID,
            responsePath: senderUser.responsePath,
            walletAddress: rewardWallet,
            reason: '2x_reward',
            userHandle: senderUser.userHandle,
            userName: senderUser.userName,
            amount: rewardAmount,
            message: rewardMessage,
            transactionHash: txReward.data.txHash,
            parentTransactionHash: transfer.transactionHash.substring(1, 8),
            dateAdded: new Date(Date.now()),
          });

          // Add the rewarded user to the array with reward amount
          rewardedUsers.push({
            userTelegramIDToReward: senderUser.userTelegramID,
            TxId: transfer.TxId,
            chainId: transfer.chainId,
            tokenSymbol: transfer.tokenSymbol,
            tokenAddress: transfer.tokenAddress,
            senderTgId: transfer.senderTgId,
            senderWallet: transfer.senderWallet,
            senderName: transfer.senderName,
            recipientTgId: transfer.recipientTgId,
            recipientWallet: transfer.recipientWallet,
            tokenAmount: transfer.tokenAmount,
            transactionHash: transfer.transactionHash,
            dateAdded: transfer.dateAdded,
            rewardAmount,
          });

          console.log(
            `[${transferCount}/${allTransfers.length}] User ${senderUser.userTelegramID} has been rewarded for sending tokens.`
          );
        } catch (error) {
          // Handle errors and log them
          console.error('An error occurred during reward distribution:', error);
        }
      }
    }

    console.log(`${rewardedUsers.length} users have been rewarded.`);
  } catch (error) {
    // Handle errors and log them
    console.error('An error occurred:', error);
  } finally {
    // Exit the script
    process.exit(0);
  }
}

// Usage: startImport(filePath)
// Description: This function imports rewards data from a CSV file into the database.
// - filePath: The path to the CSV file containing rewards data.
// Example: startImport("/path/to/your/file.csv");
const startImport = (fileName) => {
  const rewards = [];
  fs.createReadStream(fileName)
    .pipe(csv())
    .on('data', (row) => {
      rewards.push(row);
    })
    .on('end', async () => {
      await saveRewards(rewards);
      console.log('\n All data has been read \n');
      process.exit(0);
    })
    .on('error', (error) => {
      console.log('\n Errors during CSV parsing \n');
      process.exit(1);
    });
};

async function saveRewards(rewards) {
  const db = await Database.getInstance();
  const collection = db.collection('rewards-test');

  // Step 1: Create a set of existing rewards hashes
  const existingHashes = await collection.distinct('transactionHash');

  // Step 2: Filter the rewards to find the missing ones and format them
  const formattedMissingRewards = rewards
    .filter((reward) => {
      // Exclude rewards with amounts other than 100 or 50
      const amount = Number(reward.value) / 1e18;
      return (
        (amount === 100 || amount === 50) &&
        !existingHashes.includes(reward.evt_tx_hash)
      );
    })
    .map((rewards) => {
      const amount = String(Number(rewards.value) / 1e18);
      const message = generateRewardMessage(amount, rewards.evt_block_time);
      return {
        userTelegramID: '',
        responsePath: '',
        walletAddress: web3.utils.toChecksumAddress(rewards.to),
        reason: message.reason,
        userHandle: '',
        userName: '',
        amount: amount,
        message: message.description,
        transactionHash: rewards.evt_tx_hash,
        dateAdded: new Date(rewards.evt_block_time),
      };
    });

  // Step 3: Extract all walletAddress values from formattedMissingRewards
  const walletAddresses = formattedMissingRewards.map(
    (reward) => reward.walletAddress
  );

  // Step 4: Filter the users collection to match walletAddress values
  const userData = await db
    .collection(USERS_COLLECTION)
    .find({ patchwallet: { $in: walletAddresses } })
    .toArray();

  // Step 5: Loop through each formatted missing reward and fill user data
  formattedMissingRewards.forEach((reward) => {
    const matchingUser = userData.find(
      (user) => user.patchwallet === reward.walletAddress
    );

    if (matchingUser) {
      reward.userTelegramID = matchingUser.userTelegramID;
      reward.responsePath = matchingUser.responsePath;
      reward.userHandle = matchingUser.userHandle;
      reward.userName = matchingUser.userName;
    }
  });

  // Step 6: Batch insert the missing rewards into the collection if needed
  const batchSize = 10000;
  for (let i = 0; i < formattedMissingRewards.length; i += batchSize) {
    const batch = formattedMissingRewards.slice(i, i + batchSize);
    await collection.insertMany(batch);
    console.log('Batch: ', i);
  }
}

const generateRewardMessage = (amount, blockTime) => {
  const transitionDate = new Date('2023-09-05T12:00:00Z');
  const dateObj = new Date(blockTime);
  const isBeforeTuesdayNoon = dateObj < transitionDate;

  if (amount === '100') {
    return {
      reason: 'user_sign_up',
      description: 'Sign up reward',
    };
  } else if (amount === '50' && isBeforeTuesdayNoon) {
    return {
      reason: 'hunt',
      description: 'Product Hunt reward',
    };
  } else if (amount === '50' && !isBeforeTuesdayNoon) {
    return {
      reason: '2x_reward',
      description: '2x Referral reward',
    };
  } else {
    return {
      reason: undefined,
      description: undefined,
    };
  }
};

async function updateRewardMessages() {
  const db = await Database.getInstance();
  const collection = db.collection(REWARDS_COLLECTION);

  const rewards = await collection.find({}).toArray();
  const totalRewards = rewards.length;

  const bulkUpdateOperations = [];

  let processedCount = 0;

  for (const reward of rewards) {
    let updatedMessage = '';

    if (reward.amount === '100') {
      updatedMessage = 'Sign up reward';
    } else if (
      reward.amount === '50' &&
      reward.message.includes('Product Hunt')
    ) {
      updatedMessage = 'Product Hunt reward';
    } else if (
      reward.amount === '50' &&
      !reward.message.includes('Product Hunt')
    ) {
      updatedMessage = 'Referral reward';
    } else {
      updatedMessage = '2x Referral reward';
    }

    if (updatedMessage) {
      bulkUpdateOperations.push({
        updateOne: {
          filter: { _id: reward._id },
          update: { $set: { message: updatedMessage } },
        },
      });

      processedCount++;
      console.log(
        `[${processedCount}/${totalRewards}]: Message updated for ${reward.userTelegramID}`
      );
    }
  }

  if (bulkUpdateOperations.length > 0) {
    await collection.bulkWrite(bulkUpdateOperations);
  }

  console.log('\n All rewards have been updated \n');
  process.exit(0);
}

// Usage: rewardsCleanup(filePath)
// Description: This function processes rewards data from a CSV file and deletes incomplete rewards from the database.
// - filePath: The path to the CSV file containing rewards data.
// Example: rewardsCleanup("dune.csv");
async function rewardsCleanup(fileName) {
  const db = await Database.getInstance();
  const collection = db.collection('rewards-test');
  const hashesInCsv = [];
  let latestTimestamp = null;

  fs.createReadStream(fileName)
    .pipe(csv())
    .on('data', (row) => {
      hashesInCsv.push(row.evt_tx_hash);
      const rowTimestamp = new Date(row.evt_block_time);
      if (latestTimestamp === null || rowTimestamp > latestTimestamp) {
        latestTimestamp = rowTimestamp;
      }
    })
    .on('end', async () => {
      if (latestTimestamp === null) {
        console.log('No timestamp found in CSV.');
        process.exit(1);
      }

      const rewardsInDb = await collection
        .find({
          dateAdded: { $lte: latestTimestamp },
        })
        .toArray();

      const hashesToDelete = rewardsInDb
        .filter((reward) => !hashesInCsv.includes(reward.transactionHash))
        .map((reward) => reward.transactionHash);

      if (hashesToDelete.length === 0) {
        console.log('All rewards in database match the rewards in CSV.');
      } else {
        const deleteResult = await collection.deleteMany({
          transactionHash: { $in: hashesToDelete },
        });
        console.log(`${deleteResult.deletedCount} incomplete rewards deleted.`);
      }

      console.log('\n All tasks completed \n');
      process.exit(0);
    })
    .on('error', (error) => {
      console.log('\n Errors during CSV parsing \n');
      process.exit(1);
    });
}

async function updateRewardsStatus() {
  try {
    const db = await Database.getInstance();
    const rewardsCollection = db.collection(REWARDS_COLLECTION);
    const rewardsToUpdate = await rewardsCollection
      .find({ status: { $exists: false } })
      .toArray();
    const bulkWriteOperations = [];

    for (const reward of rewardsToUpdate) {
      console.log('Processing reward...');
      const updateOperation = {
        updateOne: {
          filter: { _id: reward._id },
          update: { $set: { status: 'success' } },
        },
      };

      bulkWriteOperations.push(updateOperation);
    }

    console.log('Finished processing rewards');

    if (bulkWriteOperations.length > 0) {
      const result = await rewardsCollection.bulkWrite(bulkWriteOperations);

      console.log(
        `Updated ${result.modifiedCount} rewards with status: success`
      );
    } else {
      console.log('No rewards to update.');
    }
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    process.exit(0);
  }
}

async function importMissingRewardsFromCSV(fileName) {
  const db = await Database.getInstance();
  const rewardsCollection = db.collection(REWARDS_COLLECTION);
  const usersCollection = db.collection(USERS_COLLECTION);

  const batchSize = 10000;
  const rewards = [];
  const formattedMissingRewards = [];

  if (!fs.existsSync(fileName)) {
    console.log(`File ${fileName} does not exist.`);
    process.exit(1);
  }

  fs.createReadStream(fileName)
    .pipe(csv())
    .on('data', (row) => {
      rewards.push(row);
    })
    .on('end', async () => {
      if (rewards.length === 0) {
        console.log('CSV file is empty.');
        process.exit(1);
      }

      const existingHashes = await rewardsCollection
        .aggregate([
          { $group: { _id: '$transactionHash' } },
          { $project: { _id: 0, transactionHash: '$_id' } },
        ])
        .toArray();

      const missingRewards = rewards.filter(
        (reward) => !existingHashes.includes(reward.transaction_hash)
      );

      console.log('Number of rewards in csv file: ', rewards.length);
      console.log(
        'Number of rewards in `rewards` collection: ',
        existingHashes.length
      );
      console.log(
        'Number of missing rewards in `rewards` collection: ',
        missingRewards.length
      );

      let count = 1;
      for (const reward of missingRewards) {
        console.log(
          `Formatting reward index: ${count} - total: ${missingRewards.length}`
        );

        const senderUser = await usersCollection.findOne({
          walletAddress: web3.utils.toChecksumAddress(reward.from_address),
        });
        const senderTgId = senderUser ? senderUser.userTelegramID : undefined;
        const senderName = senderUser ? senderUser.userName : undefined;
        const senderHandle = senderUser ? senderUser.userHandle : undefined;
        const senderResponsePath = senderUser
          ? senderUser.responsePath
          : undefined;

        formattedMissingRewards.push({
          userTelegramID: senderTgId,
          responsePath: senderResponsePath,
          walletAddress: web3.utils.toChecksumAddress(reward.from_address),
          reason: 'hunt',
          userHandle: senderHandle,
          userName: senderName,
          amount: String(Number(reward.value) / 1e18),
          transactionHash: reward.transaction_hash,
          dateAdded: new Date(reward.block_timestamp),
          status: 'success',
          message: 'Product Hunt reward',
        });
        count++;
      }

      if (formattedMissingRewards.length > 0) {
        for (let i = 0; i < formattedMissingRewards.length; i += batchSize) {
          const batch = formattedMissingRewards.slice(i, i + batchSize);
          await rewardsCollection.insertMany(batch);
          console.log(`Inserted batch ${i / batchSize + 1}`);
        }
      }

      console.log('\n All data has been read \n');
    })
    .on('error', (error) => {
      console.error('Errors during CSV parsing:', error);
      process.exit(1);
    });
}

/**
 * Usage: checkMissingRewards(filePath)
 * Description: This function processes rewards data from a CSV file and identifies the rewards in the database that aren't present in the CSV.
 * - filePath: The path to the CSV file containing rewards data.
 * Example: checkMissingRewards("rewardsData.csv");
 */
async function checkMissingRewards(fileName) {
  const db = await Database.getInstance();
  const collection = db.collection(REWARDS_COLLECTION);
  const hashesInCsv = new Set();

  fs.createReadStream(fileName)
    .pipe(csv())
    .on('data', (row) => {
      hashesInCsv.add(row.evt_tx_hash);
    })
    .on('end', async () => {
      const rewardsHashesInDb = await collection.distinct('transactionHash');

      const hashesNotInDb = [...hashesInCsv].filter(
        (hash) => !rewardsHashesInDb.includes(hash)
      );

      if (hashesNotInDb.length === 0) {
        console.log(
          'All rewards in CSV are present in the MongoDB collection.'
        );
      } else {
        console.log(
          "The following transaction hashes from the CSV aren't present in MongoDB rewards collection:"
        );
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

async function filterAndRemoveInvalidRewards() {
  try {
    // Connect to the database
    const db = await Database.getInstance();
    const rewardsCollection = db.collection(REWARDS_COLLECTION);

    // Find rewards documents where transactionHash doesn't start with "0x"
    const invalidRewards = await rewardsCollection
      .find({
        transactionHash: { $not: /^0x/ },
      })
      .toArray();

    if (invalidRewards.length > 0) {
      console.log(`${invalidRewards.length} invalid rewards found.`);

      // Collect the IDs of invalid rewards to delete in a batch
      const invalidRewardIds = invalidRewards.map((reward) => reward._id);

      // Use bulkWrite to delete invalid rewards in a batch
      const deleteOperations = invalidRewardIds.map((id) => ({
        deleteOne: {
          filter: { _id: new ObjectId(id) },
        },
      }));

      const result = await rewardsCollection.bulkWrite(deleteOperations);

      console.log(`${result.deletedCount} invalid rewards have been removed.`);
    } else {
      console.log('No invalid rewards found.');
    }
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // Exit the script
    process.exit(0);
  }
}

/**
 * Usage: updateParentTransactionHash()
 * Description: This function retrieves all rewards from the 'rewards' collection and updates
 * the 'parentTransactionHash' field of each reward based on the 'transactionHash' from the 'transfers' collection.
 * Example: Simply call the function without arguments: updateParentTransactionHash();
 */
async function updateParentTransactionHash() {
  try {
    // Connect to the database
    const db = await Database.getInstance();

    const transfersCollection = db.collection(TRANSFERS_COLLECTION);
    const rewardsCollection = db.collection(REWARDS_COLLECTION);

    // Fetch all rewards
    const allRewards = await rewardsCollection.find({}).toArray();

    // Fetch all transfers and store them in an array
    const allTransfers = await transfersCollection.find({}).toArray();

    // Create an array to store update operations
    const updateOperations = [];

    for (const reward of allRewards) {
      // Find the corresponding transfer
      const correspondingTransfer = allTransfers.find(
        (e) => e.TxId === reward.parentTransactionHash
      );

      // If a corresponding transfer is found
      if (correspondingTransfer) {
        // Create an update operation and add it to the array
        const updateOperation = {
          updateOne: {
            filter: { _id: reward._id },
            update: {
              $set: {
                parentTransactionHash: correspondingTransfer.transactionHash,
              },
            },
          },
        };
        updateOperations.push(updateOperation);
        console.log(`Reward to update: ${reward._id}`);
      }
    }

    // Bulk update all the rewards with the update operations
    if (updateOperations.length > 0) {
      await rewardsCollection.bulkWrite(updateOperations);
    }
  } catch (error) {
    console.error(`An error occurred: ${error.message}`);
  } finally {
    // Exit the script
    process.exit(0);
  }
}

/**
 * Calculate the average reward amount for unique users
 */
async function calculateAverageRewardAmount() {
  try {
    // Connect to the database
    const db = await Database.getInstance();
    const rewardsCollection = db.collection(REWARDS_COLLECTION); // Make sure to use the correct collection

    // Get all rewards from the collection
    const allRewards = await rewardsCollection.find({}).toArray();

    // Create an object to store the total reward amount per user
    const totalRewardAmounts = {};

    // Iterate through all rewards to calculate the total per user
    for (const reward of allRewards) {
      const userTelegramID = reward.userTelegramID;
      const amount = parseFloat(reward.amount); // Convert the string to a number

      // Check if the user is already in the totalRewardAmounts object
      if (totalRewardAmounts[userTelegramID]) {
        totalRewardAmounts[userTelegramID] += amount;
      } else {
        totalRewardAmounts[userTelegramID] = amount;
      }
    }

    // Count the number of unique users
    const uniqueUserCount = Object.keys(totalRewardAmounts).length;

    console.log('uniqueUserCount', uniqueUserCount);

    // Calculate the average amount
    let totalAmount = 0;
    for (const userTelegramID in totalRewardAmounts) {
      totalAmount += totalRewardAmounts[userTelegramID];
    }
    const averageAmount = totalAmount / uniqueUserCount;

    // Display the average amount
    console.log(`Average reward amount per user: ${averageAmount}`);
  } catch (error) {
    // Handle errors and log them
    console.error(
      'An error occurred while calculating the average reward amount:',
      error
    );
  } finally {
    // Exit the script
    process.exit(0);
  }
}

/**
 * Retrieve transaction and recipient statistics for a user and export to CSV.
 *
 * @param {string} userId - The user's Telegram ID.
 * @returns {void}
 */
async function getTransactionsAndRecipientsFromId(userId) {
  try {
    // Connect to the database
    const db = await Database.getInstance();
    const rewardsCollection = db.collection(REWARDS_COLLECTION);
    const transfersCollection = db.collection(TRANSFERS_COLLECTION);

    const rewards = await rewardsCollection
      .find({ userTelegramID: userId, reason: 'referral_link' })
      .toArray();

    // Obtenir les sponsoredUserTelegramID uniques
    const uniqueSponsoredUserIDs = [
      ...new Set(rewards.map((item) => item.sponsoredUserTelegramID)),
    ];

    // Importer tous les documents de la collection transfers
    const allTransfers = await transfersCollection.find().toArray();

    // Configurer le writer CSV
    const csvWriter = createCsvWriter({
      path: 'transaction_stats.csv',
      header: [
        { id: 'userID', title: 'User ID' },
        { id: 'transactionsDone', title: 'Transactions Done' },
        { id: 'distinctRecipients', title: 'Distinct Recipients' },
      ],
    });

    const csvData = [];

    for (let i = 0; i < uniqueSponsoredUserIDs.length; i++) {
      const userID = uniqueSponsoredUserIDs[i];
      const transactionsDone = allTransfers.filter(
        (transfer) => transfer.senderTgId === userID
      ).length;

      const distinctRecipients = new Set(
        allTransfers
          .filter((transfer) => transfer.senderTgId === userID)
          .map((transfer) => transfer.recipientTgId)
      );

      csvData.push({
        userID: userID,
        transactionsDone: transactionsDone,
        distinctRecipients: distinctRecipients.size,
      });

      // Afficher la progression
      console.log(`Progress: ${i + 1} / ${uniqueSponsoredUserIDs.length}`);
    }

    // Écrire les données CSV dans le fichier
    await csvWriter.writeRecords(csvData);

    console.log('Exported transaction stats to transaction_stats.csv');
  } catch (error) {
    // Handle errors and log them
    console.error('An error occurred:', error);
  } finally {
    // Exit the script
    process.exit(0);
  }
}

async function cleanupRewardsDB() {
  try {
    // Connect to the database
    const db = await Database.getInstance();

    const rewardsCollection = db.collection(REWARDS_COLLECTION);
    const transfersCollection = db.collection(TRANSFERS_COLLECTION);
    const usersCollection = db.collection(USERS_COLLECTION);

    // UPDATE EMPTY USERID IN REWARD DB
    const rewardsToUpdate = await rewardsCollection
      .find({
        parentTransactionHash: { $ne: '' },
        userTelegramID: '',
      })
      .toArray();

    if (rewardsToUpdate.length > 0) {
      console.log(`${rewardsToUpdate.length} rewards to update.`);

      const bulkOps = await Promise.all(
        rewardsToUpdate.map(async (reward, index) => {
          console.log(`Updating reward ${index + 1}`);
          // Find the corresponding transfer document
          const transfer = await transfersCollection.findOne({
            transactionHash: reward.parentTransactionHash,
          });

          if (transfer) {
            // Find user information based on senderTgId
            const user = await usersCollection.findOne({
              userTelegramID: transfer.senderTgId,
            });

            if (user) {
              // Update the reward document with user information
              return {
                updateOne: {
                  filter: { _id: reward._id },
                  update: {
                    $set: {
                      userTelegramID: user.userTelegramID,
                      responsePath: user.responsePath,
                      walletAddress: user.patchwallet,
                      userHandle: user.userHandle,
                      userName: user.userName,
                    },
                  },
                },
              };
            }
          }

          return null; // Reward couldn't be updated
        })
      );

      const bulkWriteOps = bulkOps.filter((op) => op !== null);

      if (bulkWriteOps.length > 0) {
        const result = await rewardsCollection.bulkWrite(bulkWriteOps);
        console.log(`${result.modifiedCount} rewards have been updated.`);
      } else {
        console.log('No rewards updated.');
      }
    } else {
      console.log('No rewards to update.');
    }

    // CLEAN UP REWARD DB BY REMOVING REWARDS TO SOURCE WALLET
    const result = await rewardsCollection.deleteMany({
      walletAddress: SOURCE_WALLET_ADDRESS,
    });
    console.log(
      `${result.deletedCount} reward documents to our source wallet have been deleted.`
    );
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // Exit the script
    process.exit(0);
  }
}
