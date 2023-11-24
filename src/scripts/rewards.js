import { Database } from '../db/conn.js';
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  sendTokens,
} from '../utils/patchwallet.js';
import { createObjectCsvWriter as createCsvWriter } from 'csv-writer';
import fs from 'fs';
import csv from 'csv-parser';
import web3 from 'web3';
import {
  REWARDS_COLLECTION,
  TRANSACTION_STATUS,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from '../utils/constants.js';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { SOURCE_TG_ID, SOURCE_WALLET_ADDRESS } from '../../secrets.js';

/**
 * Distributes sign-up rewards of 100 Grindery One Tokens to eligible users.
 * Manages the renewal of the Patch Wallet access token.
 *
 * @returns {void} No return value.
 */
async function distributeSignupRewards() {
  // Set startDate to 24 hours before the current date and time
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - 24);

  // Number of users processed in each batch
  const batchSize = 10;

  try {
    // Retrieve database instance and rewards collection
    const db = await Database.getInstance();
    const rewardsCollection = db.collection(REWARDS_COLLECTION);

    // Initialize Patch Wallet access token and last renewal time
    let patchWalletAccessToken = await getPatchWalletAccessToken();
    let lastTokenRenewalTime = Date.now();

    // Fetch users added within the last 24 hours
    const allUsers = await db
      .collection(USERS_COLLECTION)
      .find({
        dateAdded: { $gt: new Date(startDate) },
      })
      .toArray();

    // Counter for processed users
    let userCount = 0;

    // Fetch successful sign-up rewards within the last 48 hours
    const allRewards = await rewardsCollection
      .find({
        reason: 'user_sign_up',
        status: 'success',
        dateAdded: { $gt: new Date(new Date(startDate) - 24 * 60 * 60 * 1000) },
      })
      .toArray();

    // Array to hold batch promises
    const batchPromises = [];

    for (const user of allUsers) {
      // Increment user count for logging
      userCount++;

      // Check if the user has not received a sign-up reward
      if (
        !allRewards.some(
          (reward) => reward.userTelegramID === user.userTelegramID
        )
      ) {
        console.log(
          `[${userCount}/${allUsers.length}] User ${user.userTelegramID} has no sign up reward`
        );

        // Manage token renewal at intervals
        if (Date.now() - lastTokenRenewalTime >= 50 * 60 * 1000) {
          patchWalletAccessToken = await getPatchWalletAccessToken();
          lastTokenRenewalTime = Date.now();

          console.log('PatchWallet access token has been updated.');
        }

        const userPromise = (async () => {
          try {
            // Send reward to eligible users
            const txReward = await sendTokens(
              SOURCE_TG_ID,
              user.patchwallet,
              '100',
              patchWalletAccessToken
            );

            // Record successful transactions in rewards collection
            if (txReward.data.txHash) {
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
            console.error(
              'An error occurred during reward distribution:',
              error
            );
          }
        })();

        batchPromises.push(userPromise);
      }

      // Execute reward distribution in batches
      if (batchPromises.length === batchSize || userCount === allUsers.length) {
        await Promise.all(batchPromises);
        batchPromises.length = 0; // Reset batch promises array
      }
    }

    console.log('All sign-up rewards have been distributed.');
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    // Ensure process exit for cleanup and termination
    process.exit(0);
  }
}

/**
 * Distributes referral rewards to eligible users who made successful referrals.
 * Manages the renewal of the Patch Wallet access token.
 *
 * @returns {void} No return value.
 */
async function distributeReferralRewards() {
  // Set startDate to 24 hours before the current date and time
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - 24);

  // Number of users processed in each batch
  const batchSize = 10;

  try {
    // Retrieve database instance and necessary collections
    const db = await Database.getInstance();
    const rewardsCollection = db.collection(REWARDS_COLLECTION);
    const usersCollection = db.collection(USERS_COLLECTION);
    const transfersCollection = db.collection(TRANSFERS_COLLECTION);

    // Fetch users and transfers added within the last 24 hours
    const allUsers = await usersCollection
      .find({ dateAdded: { $gt: new Date(startDate) } })
      .toArray();
    const allTransfers = await transfersCollection
      .find({ status: TRANSACTION_STATUS.SUCCESS })
      .sort({ dateAdded: 1 })
      .toArray();
    const allRewards = await rewardsCollection
      .find({
        reason: '2x_reward',
        status: TRANSACTION_STATUS.SUCCESS,
        dateAdded: { $gt: new Date(new Date(startDate) - 24 * 60 * 60 * 1000) },
      })
      .toArray();

    // Initial PatchWallet access token and last renewal time
    let patchWalletAccessToken = await getPatchWalletAccessToken();
    let lastTokenRenewalTime = Date.now();

    // Counter for processed users
    let userCount = 0;
    // Array to hold batch promises
    const batchPromises = [];

    for (const user of allUsers) {
      // Increment user count for logging
      userCount++;

      // Find the first valid transfer for the user
      const firstValidTransfer = allTransfers.find(
        (transfer) =>
          transfer.recipientTgId === user.userTelegramID &&
          transfer.senderTgId !== user.userTelegramID &&
          new Date(transfer.dateAdded) < new Date(user.dateAdded)
      );

      if (!firstValidTransfer) continue;

      // Check for existing rewards for this user
      const existingReward = allRewards.some(
        (reward) =>
          reward.parentTransactionHash === firstValidTransfer.transactionHash ||
          web3.utils.toChecksumAddress(reward.newUserAddress) ===
            web3.utils.toChecksumAddress(user.patchwallet)
      );

      if (existingReward) continue;

      console.log(
        `[${userCount}/${allUsers.length}] User ${firstValidTransfer.senderTgId} has no referral reward for sending tokens to ${user.userTelegramID}.`
      );

      const rewardPromise = (async () => {
        try {
          // Determine reward details
          const rewardWallet = await getPatchWalletAddressFromTgId(
            firstValidTransfer.senderTgId
          );
          const rewardAmount =
            new Date(firstValidTransfer.dateAdded) <
              new Date('2023-09-07T12:00:00Z') &&
            Number(firstValidTransfer.tokenAmount) < 1000
              ? (Number(firstValidTransfer.tokenAmount) * 2).toString()
              : '50';

          // Renew PatchWallet access token if needed
          if (Date.now() - lastTokenRenewalTime >= 50 * 60 * 1000) {
            patchWalletAccessToken = await getPatchWalletAccessToken();
            lastTokenRenewalTime = Date.now();
            console.log('PatchWallet access token has been updated.');
          }

          // Send tokens and add rewards to collection
          const txReward = await sendTokens(
            SOURCE_TG_ID,
            rewardWallet,
            rewardAmount,
            patchWalletAccessToken
          );

          await rewardsCollection.insertOne({
            eventId: uuidv4(),
            userTelegramID: firstValidTransfer.senderTgId,
            walletAddress: rewardWallet,
            reason: '2x_reward',
            amount: rewardAmount.toString(),
            message: 'Referral reward',
            transactionHash: txReward.data.txHash,
            userOpHash: txReward.data.userOpHash,
            parentTransactionHash: firstValidTransfer.transactionHash,
            dateAdded: new Date(),
            newUserAddress:
              user.patchwallet ??
              (await getPatchWalletAddressFromTgId(user.userTelegramID)),
            status: TRANSACTION_STATUS.SUCCESS,
          });

          console.log(
            `User ${firstValidTransfer.senderTgId} has been rewarded for sending tokens to ${user.userTelegramID}.`
          );
        } catch (error) {
          console.error('An error occurred during reward distribution:', error);
        }
      })();

      batchPromises.push(rewardPromise);

      // Execute batch when reaching batchSize or end of user list
      if (batchPromises.length === batchSize || userCount === allUsers.length) {
        await Promise.all(batchPromises);
        batchPromises.length = 0; // Reset batch promises array
      }
    }

    console.log(`All users have been rewarded.`);
  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    process.exit(0); // Exit the process after execution
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
