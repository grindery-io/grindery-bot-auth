import { Database } from '../../db/conn.js';
import {
  REWARDS_COLLECTION,
  TRANSACTION_STATUS,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from '../constants.js';
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  getTxStatus,
  sendTokens,
} from '../patchwallet.js';
import axios from 'axios';
import 'dotenv/config';
import { reward_helpers } from '../rewardHelpers.js';
import { createUserTelegram } from '../user.js';

/**
 * Handles the signup reward for a user.
 *
 * @param {Object} db - The database object.
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} responsePath - The response path.
 * @param {string} userHandle - The user's handle.
 * @param {string} userName - The user's name.
 * @param {string} rewardWallet - The wallet for the reward.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleSignUpReward(db, params) {
  try {
    // Check if this event already exists
    const reward = await db.collection(REWARDS_COLLECTION).findOne({
      userTelegramID: params.userTelegramID,
      eventId: params.eventId,
      reason: 'user_sign_up',
    });

    if (
      reward?.status === TRANSACTION_STATUS.SUCCESS ||
      (await db.collection(REWARDS_COLLECTION).findOne({
        userTelegramID: params.userTelegramID,
        eventId: { $ne: params.eventId },
        reason: 'user_sign_up',
      }))
    ) {
      // The user has already received a signup reward, stop processing
      console.log(
        `[${params.eventId}] ${params.userTelegramID} user already received signup reward.`
      );
      return true;
    }

    if (!reward) {
      // Create a new reward record
      await reward_helpers.insertRewardDB(db, {
        eventId: params.eventId,
        userTelegramID: params.userTelegramID,
        responsePath: params.responsePath,
        walletAddress: params.patchwallet,
        reason: 'user_sign_up',
        userHandle: params.userHandle,
        userName: params.userName,
        amount: '100',
        message: 'Sign up reward',
        dateAdded: new Date(),
        status: TRANSACTION_STATUS.PENDING,
      });

      console.log(
        `[${params.eventId}] pending sign up reward added to the database.`
      );
    }

    let txReward = undefined;

    if (reward?.status === TRANSACTION_STATUS.PENDING_HASH) {
      if (reward.dateAdded < new Date(new Date() - 10 * 60 * 1000)) {
        console.log(
          `[${params.eventId}] was stopped due to too long treatment duration (> 10 min).`
        );

        await reward_helpers.updateRewardDB(db, {
          userTelegramID: params.userTelegramID,
          eventId: params.eventId,
          reason: 'user_sign_up',
          responsePath: params.responsePath,
          walletAddress: params.patchwallet,
          userHandle: params.userHandle,
          userName: params.userName,
          amount: '100',
          message: 'Sign up reward',
          status: TRANSACTION_STATUS.FAILURE,
        });
        return true;
      }

      if (reward?.userOpHash) {
        try {
          txReward = await getTxStatus(reward.userOpHash);
        } catch (error) {
          console.error(
            `[${params.eventId}] Error processing PatchWallet user sign up reward status for ${params.userTelegramID}: ${error}`
          );
          return false;
        }
      } else {
        // Update the reward record to mark it as successful
        await reward_helpers.updateRewardDB(db, {
          userTelegramID: params.userTelegramID,
          eventId: params.eventId,
          reason: 'user_sign_up',
          responsePath: params.responsePath,
          walletAddress: params.patchwallet,
          userHandle: params.userHandle,
          userName: params.userName,
          amount: '100',
          message: 'Sign up reward',
          status: TRANSACTION_STATUS.SUCCESS,
          dateAdded: new Date(),
        });
        return true;
      }
    }

    if (!txReward) {
      try {
        // Send tokens to the user
        txReward = await sendTokens(
          process.env.SOURCE_TG_ID,
          params.patchwallet,
          '100',
          await getPatchWalletAccessToken()
        );
      } catch (error) {
        console.error(
          `[${params.eventId}] Error processing PatchWallet user sign up reward for ${params.userTelegramID}: ${error}`
        );
        return false;
      }
    }

    if (txReward.data.txHash) {
      const dateAdded = new Date();

      // Update the reward record to mark it as successful
      await reward_helpers.updateRewardDB(db, {
        userTelegramID: params.userTelegramID,
        eventId: params.eventId,
        reason: 'user_sign_up',
        responsePath: params.responsePath,
        walletAddress: params.patchwallet,
        userHandle: params.userHandle,
        userName: params.userName,
        amount: '100',
        message: 'Sign up reward',
        status: TRANSACTION_STATUS.SUCCESS,
        transactionHash: txReward.data.txHash,
        dateAdded: new Date(),
      });

      // Find the reward record by transaction hash
      const reward_db = await db
        .collection(REWARDS_COLLECTION)
        .findOne({ transactionHash: txReward.data.txHash });

      console.log(
        `[${
          txReward.data.txHash
        }] signup reward added to Mongo DB with event ID ${
          params.eventId
        } and Object ID ${reward_db._id.toString()}.`
      );

      // Notify external system about the reward
      await axios.post(process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK, {
        userTelegramID: params.userTelegramID,
        responsePath: params.responsePath,
        walletAddress: params.patchwallet,
        reason: 'user_sign_up',
        userHandle: params.userHandle,
        userName: params.userName,
        amount: '100',
        message: 'Sign up reward',
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
      });

      console.log(`[${params.userTelegramID}] user added to the database.`);
      return true;
    }

    if (txReward.data.userOpHash) {
      await reward_helpers.updateRewardDB(db, {
        userTelegramID: params.userTelegramID,
        eventId: params.eventId,
        reason: 'user_sign_up',
        status: TRANSACTION_STATUS.PENDING_HASH,
        userOpHash: txReward.data.userOpHash,
      });

      // Find the reward record by transaction hash
      const reward_db = await db
        .collection(REWARDS_COLLECTION)
        .findOne({ userOpHash: txReward.data.userOpHash });

      console.log(
        `[${
          txReward.data.userOpHash
        }] signup reward userOpHash added to Mongo DB with event ID ${
          params.eventId
        } and Object ID ${reward_db._id.toString()}.`
      );
    }

    return false;
  } catch (error) {
    console.error(
      `[${params.eventId}] Error processing sign up reward event: ${error}`
    );
  }

  return true;
}

/**
 * Handles the referral reward for a user.
 *
 * @param {Object} db - The database object.
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} responsePath - The response path.
 * @param {string} userHandle - The user's handle.
 * @param {string} userName - The user's name.
 * @param {string} patchwallet - The user's Patchwallet.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleReferralReward(db, params) {
  try {
    let parentTx = undefined;

    // Retrieve all transfers where this user is the recipient
    for await (const transfer of db.collection(TRANSFERS_COLLECTION).find({
      senderTgId: { $ne: params.userTelegramID },
      recipientTgId: params.userTelegramID,
    })) {
      if (!parentTx || transfer.dateAdded < parentTx.dateAdded) {
        parentTx = transfer;
      }
    }

    if (!parentTx) {
      console.log(
        `[${params.eventId}] no referral reward to distribute with ${params.userTelegramID} as a new user.`
      );
      return true;
    }

    // Retrieve sender information from the "users" collection
    const senderInformation = await db
      .collection(USERS_COLLECTION)
      .findOne({ userTelegramID: parentTx.senderTgId });

    if (!senderInformation) {
      console.log(
        `[${params.eventId}] sender ${parentTx.senderTgId} who is supposed to receive a referral reward is not a user.`
      );
      return true;
    }

    const reward = await db.collection(REWARDS_COLLECTION).findOne({
      reason: '2x_reward',
      eventId: params.eventId,
    });

    if (
      reward?.status === TRANSACTION_STATUS.SUCCESS ||
      (await db.collection(REWARDS_COLLECTION).findOne({
        reason: '2x_reward',
        eventId: { $ne: params.eventId },
        userTelegramID: senderInformation.userTelegramID,
        newUserAddress: params.patchwallet,
      }))
    ) {
      console.log(
        `[${eventId}] referral reward already distributed or in process of distribution elsewhere for ${senderInformation.userTelegramID} concerning new user ${params.userTelegramID}`
      );
      return true;
    }

    const senderWallet =
      senderInformation?.patchwallet ??
      (await getPatchWalletAddressFromTgId(senderInformation.userTelegramID));

    if (!reward) {
      await reward_helpers.insertRewardDB(db, {
        eventId: params.eventId,
        userTelegramID: senderInformation.userTelegramID,
        responsePath: senderInformation.responsePath,
        walletAddress: senderWallet,
        reason: '2x_reward',
        userHandle: senderInformation.userHandle,
        userName: senderInformation.userName,
        amount: '50',
        message: 'Referral reward',
        dateAdded: new Date(),
        parentTransactionHash: parentTx.transactionHash,
        status: TRANSACTION_STATUS.PENDING,
        newUserAddress: params.patchwallet,
      });

      console.log(
        `[${params.eventId}] pending referral reward for ${senderWallet} about ${parentTx.transactionHash} concerning new user ${params.userTelegramID} added to the database.`
      );
    }

    let txReward = undefined;

    if (reward?.status === TRANSACTION_STATUS.PENDING_HASH) {
      if (reward.dateAdded < new Date(new Date() - 10 * 60 * 1000)) {
        console.log(
          `[${params.eventId}] was stopped due to too long treatment duration (> 10 min).`
        );

        await reward_helpers.updateRewardDB(db, {
          eventId: params.eventId,
          reason: '2x_reward',
          parentTransactionHash: parentTx.transactionHash,
          userTelegramID: senderInformation.userTelegramID,
          responsePath: senderInformation.responsePath,
          walletAddress: senderWallet,
          userHandle: senderInformation.userHandle,
          userName: senderInformation.userName,
          amount: '50',
          message: 'Referral reward',
          status: TRANSACTION_STATUS.FAILURE,
          newUserAddress: params.patchwallet,
        });

        return true;
      }

      if (reward?.userOpHash) {
        try {
          txReward = await getTxStatus(reward.userOpHash);
        } catch (error) {
          console.error(
            `[${params.eventId}] Error processing PatchWallet user sign up reward status for ${params.userTelegramID}: ${error}`
          );
          return false;
        }
      } else {
        // Update the reward record to mark it as successful
        await reward_helpers.updateRewardDB(db, {
          eventId: params.eventId,
          reason: '2x_reward',
          userTelegramID: senderInformation.userTelegramID,
          eventId: params.eventId,
          reason: '2x_reward',
          parentTransactionHash: parentTx.transactionHash,
          userTelegramID: senderInformation.userTelegramID,
          responsePath: senderInformation.responsePath,
          walletAddress: senderWallet,
          userHandle: senderInformation.userHandle,
          userName: senderInformation.userName,
          amount: '50',
          message: 'Referral reward',
          dateAdded: new Date(),
          status: TRANSACTION_STATUS.SUCCESS,
          newUserAddress: params.patchwallet,
        });
        return true;
      }
    }

    if (!txReward) {
      try {
        txReward = await sendTokens(
          process.env.SOURCE_TG_ID,
          senderWallet,
          '50',
          await getPatchWalletAccessToken()
        );
      } catch (error) {
        console.error(
          `[${params.eventId}] Error processing PatchWallet referral reward for ${senderWallet}: ${error}`
        );
        return false;
      }
    }

    if (txReward.data.txHash) {
      const dateAdded = new Date();

      await reward_helpers.updateRewardDB(db, {
        eventId: params.eventId,
        reason: '2x_reward',
        parentTransactionHash: parentTx.transactionHash,
        userTelegramID: senderInformation.userTelegramID,
        responsePath: senderInformation.responsePath,
        walletAddress: senderWallet,
        userHandle: senderInformation.userHandle,
        userName: senderInformation.userName,
        amount: '50',
        message: 'Referral reward',
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
        status: TRANSACTION_STATUS.SUCCESS,
        newUserAddress: params.patchwallet,
      });

      console.log(
        `[${txReward.data.txHash}] referral reward added to Mongo DB with event ID ${params.eventId}.`
      );

      await axios.post(process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK, {
        newUserTgId: params.userTelegramID,
        newUserResponsePath: params.responsePath,
        newUserUserHandle: params.userHandle,
        newUserUserName: params.userName,
        newUserPatchwallet: params.patchwallet,
        userTelegramID: senderInformation.userTelegramID,
        responsePath: senderInformation.responsePath,
        walletAddress: senderWallet,
        reason: '2x_reward',
        userHandle: senderInformation.userHandle,
        userName: senderInformation.userName,
        amount: '50',
        message: 'Referral reward',
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
        parentTransactionHash: parentTx.transactionHash,
      });

      console.log(
        `[${txReward.data.txHash}] referral reward sent to FlowXO with event ID ${params.eventId}.`
      );

      return true;
    }

    if (txReward.data.userOpHash) {
      await reward_helpers.updateRewardDB(db, {
        eventId: params.eventId,
        reason: '2x_reward',
        parentTransactionHash: parentTx.transactionHash,
        userTelegramID: senderInformation.userTelegramID,
        responsePath: senderInformation.responsePath,
        walletAddress: senderWallet,
        userHandle: senderInformation.userHandle,
        userName: senderInformation.userName,
        amount: '50',
        message: 'Referral reward',
        dateAdded: new Date(),
        userOpHash: txReward.data.userOpHash,
        status: TRANSACTION_STATUS.PENDING_HASH,
        newUserAddress: params.patchwallet,
      });
    }
    return false;
  } catch (error) {
    console.error(
      `[${params.eventId}] Error processing referral reward event: ${error}`
    );
  }

  return true;
}

/**
 * Handles the referral link reward for a user.
 *
 * @param {Object} db - The database object.
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} referentUserTelegramID - The Telegram ID of the referent user.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleLinkReward(
  db,
  eventId,
  userTelegramID,
  referentUserTelegramID
) {
  try {
    const referent = await db
      .collection(USERS_COLLECTION)
      .findOne({ userTelegramID: referentUserTelegramID });

    if (!referent) {
      // The referent user is not in the database
      console.log(
        `[${eventId}] ${referentUserTelegramID} referent user is not a user to process the link reward.`
      );
      return true;
    }

    const rewardWallet =
      referent?.patchwallet ??
      (await getPatchWalletAddressFromTgId(referentUserTelegramID));

    const reward = await db.collection(REWARDS_COLLECTION).findOne({
      eventId: eventId,
      userTelegramID: referentUserTelegramID,
      sponsoredUserTelegramID: userTelegramID,
      reason: 'referral_link',
    });

    // Check if the user has already received a signup reward
    if (
      reward?.status === TRANSACTION_STATUS.SUCCESS ||
      (await db.collection(REWARDS_COLLECTION).findOne({
        sponsoredUserTelegramID: userTelegramID,
        reason: 'referral_link',
        eventId: { $ne: eventId },
      }))
    ) {
      // The user has already received a referral link reward, stop processing
      console.log(
        `[${eventId}] ${userTelegramID} already sponsored another user for a referral link reward.`
      );
      return true;
    }

    if (!reward) {
      await reward_helpers.insertRewardDB(db, {
        eventId: eventId,
        userTelegramID: referentUserTelegramID,
        responsePath: referent.responsePath,
        walletAddress: rewardWallet,
        reason: 'referral_link',
        userHandle: referent.userHandle,
        userName: referent.userName,
        amount: '10',
        message: 'Referral link',
        dateAdded: new Date(),
        sponsoredUserTelegramID: userTelegramID,
        status: TRANSACTION_STATUS.PENDING,
      });

      console.log(
        `[${eventId}] pending link reward for ${rewardWallet} about sponsoring ${userTelegramID} added to the database.`
      );
    }

    let txReward = undefined;

    if (reward?.status === TRANSACTION_STATUS.PENDING_HASH) {
      if (reward.dateAdded < new Date(new Date() - 10 * 60 * 1000)) {
        console.log(
          `[${eventId}] was stopped due to too long treatment duration (> 10 min).`
        );

        await reward_helpers.updateRewardDB(db, {
          userTelegramID: referentUserTelegramID,
          eventId: eventId,
          reason: 'referral_link',
          responsePath: referent.responsePath,
          walletAddress: rewardWallet,
          reason: 'referral_link',
          userHandle: referent.userHandle,
          userName: referent.userName,
          amount: '10',
          message: 'Referral link',
          dateAdded: new Date(),
          sponsoredUserTelegramID: userTelegramID,
          status: TRANSACTION_STATUS.FAILURE,
        });

        return true;
      }

      if (reward?.userOpHash) {
        try {
          txReward = await getTxStatus(reward.userOpHash);
        } catch (error) {
          console.error(
            `[${eventId}] Error processing PatchWallet link reward reward status for ${referentUserTelegramID}: ${error}`
          );
          return false;
        }
      } else {
        // Update the reward record to mark it as successful
        await reward_helpers.updateRewardDB(db, {
          eventId: eventId,
          userTelegramID: referentUserTelegramID,
          responsePath: referent.responsePath,
          walletAddress: rewardWallet,
          reason: 'referral_link',
          userHandle: referent.userHandle,
          userName: referent.userName,
          amount: '10',
          message: 'Referral link',
          dateAdded: new Date(),
          sponsoredUserTelegramID: userTelegramID,
          status: TRANSACTION_STATUS.SUCCESS,
        });
        return true;
      }
    }

    if (!txReward) {
      try {
        txReward = await sendTokens(
          process.env.SOURCE_TG_ID,
          rewardWallet,
          '10',
          await getPatchWalletAccessToken()
        );
      } catch (error) {
        console.error(
          `[${eventId}] Error processing PatchWallet link reward for ${rewardWallet}: ${error}`
        );
        return false;
      }
    }

    if (txReward.data.txHash) {
      const dateAdded = new Date();

      // Add the reward to the "rewards" collection
      await reward_helpers.updateRewardDB(db, {
        userTelegramID: referentUserTelegramID,
        sponsoredUserTelegramID: userTelegramID,
        reason: 'referral_link',
        eventId: eventId,
        responsePath: referent.responsePath,
        walletAddress: rewardWallet,
        userHandle: referent.userHandle,
        userName: referent.userName,
        amount: '10',
        message: 'Referral link',
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
        status: TRANSACTION_STATUS.SUCCESS,
      });

      console.log(
        `[${txReward.data.txHash}] link reward added to Mongo DB with event ID ${eventId}.`
      );

      await axios.post(process.env.FLOWXO_NEW_LINK_REWARD_WEBHOOK, {
        userTelegramID: referentUserTelegramID,
        responsePath: referent.responsePath,
        walletAddress: rewardWallet,
        reason: 'referral_link',
        userHandle: referent.userHandle,
        userName: referent.userName,
        amount: '10',
        message: 'Referral link',
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
        sponsoredUserTelegramID: userTelegramID,
      });

      console.log(
        `[${txReward.data.txHash}] link reward sent to FlowXO with event ID ${eventId}.`
      );

      return true;
    }

    if (txReward.data.userOpHash) {
      await reward_helpers.updateRewardDB(db, {
        userTelegramID: referentUserTelegramID,
        sponsoredUserTelegramID: userTelegramID,
        reason: 'referral_link',
        eventId: eventId,
        responsePath: referent.responsePath,
        walletAddress: rewardWallet,
        userHandle: referent.userHandle,
        userName: referent.userName,
        amount: '10',
        message: 'Referral link',
        status: TRANSACTION_STATUS.PENDING_HASH,
        userOpHash: txReward.data.userOpHash,
      });
    }

    return false;
  } catch (error) {
    console.error(`[${eventId}] Error processing link reward event: ${error}`);
  }
  return true;
}

/**
 * Handles the processing of a new reward for a user.
 *
 * @param {Object} params - The parameters containing user and event details.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleNewReward(params) {
  const db = await Database.getInstance();

  const user = await createUserTelegram(
    params.userTelegramID,
    params.responsePath,
    params.userHandle,
    params.userName
  );

  if (user.isInDatabase) {
    // The user already exists, stop processing
    console.log(
      `[${params.eventId}] ${user.userTelegramID} user already exists.`
    );
    return true;
  }

  if (!user.patchwallet) {
    return false;
  }

  if (
    !(await webhook_utils.handleSignUpReward(db, {
      ...params,
      patchwallet: user.patchwallet,
    }))
  ) {
    return false;
  }

  if (
    !(await webhook_utils.handleReferralReward(db, {
      ...params,
      patchwallet: user.patchwallet,
    }))
  ) {
    return false;
  }

  if (params.referentUserTelegramID) {
    if (
      !(await webhook_utils.handleLinkReward(
        db,
        params.eventId,
        params.userTelegramID,
        params.referentUserTelegramID
      ))
    ) {
      return false;
    }
  }

  if (!(await user.isUserInDatabase())) {
    await user.saveToDatabase(params.eventId);
    await user.saveToSegment(params.eventId);
  }

  return true;
}

export const webhook_utils = {
  handleSignUpReward,
  handleLinkReward,
  handleReferralReward,
};
