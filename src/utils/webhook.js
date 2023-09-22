import { Database } from "../db/conn.js";
import {
  REWARDS_TEST_COLLECTION,
  TRANSFERS_TEST_COLLECTION,
  USERS_TEST_COLLECTION,
} from "./constants.js";
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  sendTokens,
} from "./patchwallet.js";
import { addIdentitySegment, addTrackSegment } from "./segment.js";
import axios from "axios";
import "dotenv/config";

/**
 * Handles a new user registration event.
 * @param {object} params - User registration parameters.
 * @returns {Promise<boolean>} Returns a Promise that resolves to true if the user is successfully registered, false otherwise.
 */
export const handleNewUser = async (params) => {
  try {
    const db = await Database.getInstance();

    // Check if the user already exists in the "users" collection
    const user = await db
      .collection(USERS_TEST_COLLECTION)
      .findOne({ userTelegramID: params.userTelegramID });
    if (user) {
      // The user already exists, stop processing
      console.log(`[${user.userTelegramID}] user already exist.`);
      return true;
    }

    const dateAdded = new Date();
    const patchwallet = await getPatchWalletAddressFromTgId(
      params.userTelegramID
    );

    // The user doesn't exist, add him to the "users" collection
    await db.collection(USERS_TEST_COLLECTION).insertOne({
      userTelegramID: params.userTelegramID,
      responsePath: params.responsePath,
      userHandle: params.userHandle,
      userName: params.userName,
      patchwallet: patchwallet,
      dateAdded: dateAdded,
    });

    await addIdentitySegment({
      ...params,
      patchwallet: patchwallet,
      dateAdded: dateAdded,
    });

    await axios.post(process.env.FLOWXO_NEW_USER_WEBHOOK, {
      userTelegramID: params.userTelegramID,
      responsePath: params.responsePath,
      userHandle: params.userHandle,
      userName: params.userName,
      patchwallet: patchwallet,
      dateAdded: dateAdded,
    });

    console.log(`[${params.userTelegramID}] user added to the database.`);
    return true;
  } catch (error) {
    console.error("Error processing new user event:", error);
  }
  return false;
};

/**
 * Handles a new sign-up reward event.
 * @param {object} params - Sign-up reward parameters.
 * @returns {Promise<boolean>} Returns a Promise that resolves to true if the reward is successfully processed, false otherwise.
 */
export const handleNewSignUpReward = async (params) => {
  try {
    const db = await Database.getInstance();

    // Check if the user already exists in the "users" collection
    const user = await db
      .collection(USERS_TEST_COLLECTION)
      .findOne({ userTelegramID: params.userTelegramID });

    if (user) {
      // The user already exists, stop processing
      console.log(`[${user.userTelegramID}] user already exist.`);
      return true;
    }

    // Check if the user has already received a signup reward
    const userSignupReward = await db
      .collection(REWARDS_TEST_COLLECTION)
      .findOne({
        userTelegramID: params.userTelegramID,
        reason: "user_sign_up",
      });

    if (userSignupReward) {
      // The user has already received a signup reward, stop processing
      console.log(
        `[${userSignupReward.userTelegramID}] user already received signup reward.`
      );
      return true;
    }

    const rewardWallet = await getPatchWalletAddressFromTgId(
      params.userTelegramID
    );

    const txReward = await sendTokens(
      process.env.SOURCE_TG_ID,
      rewardWallet,
      "100",
      await getPatchWalletAccessToken()
    );

    if (txReward.data.txHash) {
      const dateAdded = new Date();

      // Add the reward to the "rewards" collection
      await db.collection(REWARDS_TEST_COLLECTION).insertOne({
        userTelegramID: params.userTelegramID,
        responsePath: params.responsePath,
        walletAddress: rewardWallet,
        reason: "user_sign_up",
        userHandle: params.userHandle,
        userName: params.userName,
        amount: "100",
        message: "Sign up reward",
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
      });

      console.log(`[${params.userTelegramID}] signup reward added.`);

      // The user doesn't exist, add him to the "users" collection
      await db.collection(USERS_TEST_COLLECTION).insertOne({
        userTelegramID: params.userTelegramID,
        userHandle: params.userHandle,
        userName: params.userName,
        patchwallet: rewardWallet,
        dateAdded: dateAdded,
      });

      await addIdentitySegment({
        ...params,
        patchwallet: rewardWallet,
        dateAdded: dateAdded,
      });

      await axios.post(process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK, {
        userTelegramID: params.userTelegramID,
        responsePath: params.responsePath,
        walletAddress: rewardWallet,
        reason: "user_sign_up",
        userHandle: params.userHandle,
        userName: params.userName,
        amount: "100",
        message: "Sign up reward",
        transactionHash: txReward.data.txHash,
        dateAdded: dateAdded,
      });

      console.log(`[${params.userTelegramID}] user added to the database.`);
      return true;
    }
  } catch (error) {
    console.error("Error processing signup reward event:", error);
  }
  return false;
};

/**
 * Handles a new referral reward event.
 * @param {object} params - Referral reward parameters.
 * @returns {Promise<boolean>} Returns a Promise that resolves to true if the reward is successfully processed, false otherwise.
 */
export const handleNewReferralReward = async (params) => {
  try {
    const db = await Database.getInstance();

    // Check if the user already exists in the "users" collection
    const user = await db
      .collection(USERS_TEST_COLLECTION)
      .findOne({ userTelegramID: params.userTelegramID });

    if (user) {
      // The user already exists, stop processing
      console.log(`[${user.userTelegramID}] user already exist.`);
      return true;
    }

    // Retrieve all transfers where this user is the recipient
    const referralTransfers = await db
      .collection(TRANSFERS_TEST_COLLECTION)
      .find({
        senderTgId: { $ne: params.userTelegramID },
        recipientTgId: params.userTelegramID,
      })
      .toArray();

    // Initialize a flag to track the success of all transactions
    let processed = true;

    // For each transfer, award a reward to the sender
    for (const transfer of referralTransfers) {
      try {
        // Retrieve sender information from the "users" collection
        const senderInformation = await db
          .collection(USERS_TEST_COLLECTION)
          .findOne({ userTelegramID: transfer.senderTgId });

        const senderWallet =
          senderInformation.patchwallet ??
          (await getPatchWalletAddressFromTgId(
            senderInformation.userTelegramID
          ));

        const txReward = await sendTokens(
          process.env.SOURCE_TG_ID,
          senderWallet,
          "50",
          await getPatchWalletAccessToken()
        );

        if (txReward.data.txHash) {
          const dateAdded = new Date();

          // Add the reward to the "rewards" collection
          await db.collection(REWARDS_TEST_COLLECTION).insertOne({
            userTelegramID: senderInformation.userTelegramID,
            responsePath: senderInformation.responsePath,
            walletAddress: senderWallet,
            reason: "2x_reward",
            userHandle: senderInformation.userHandle,
            userName: senderInformation.userName,
            amount: "50",
            message: "Referral reward",
            transactionHash: txReward.data.txHash,
            dateAdded: dateAdded,
          });

          await axios.post(process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK, {
            newUserTgId: user.userTelegramID,
            newUserResponsePath: user.responsePath,
            newUserUserHandle: user.userHandle,
            newUserUserName: user.userName,
            newUserPatchwallet: user.patchwallet,
            userTelegramID: senderInformation.userTelegramID,
            responsePath: senderInformation.responsePath,
            walletAddress: senderWallet,
            reason: "2x_reward",
            userHandle: senderInformation.userHandle,
            userName: senderInformation.userName,
            amount: "50",
            message: "Referral reward",
            transactionHash: txReward.data.txHash,
            dateAdded: dateAdded,
          });

          console.log(
            `[${senderInformation.userTelegramID}] referral reward added.`
          );
        } else {
          // If a transaction fails, set the flag to false
          processed = false;
        }
      } catch (error) {
        console.error("Error during sign up reward transaction:", error);
        // If a transaction fails, set the flag to false
        processed = false;
      }
    }

    return processed;
  } catch (error) {
    console.error("Error processing referral reward event:", error);
  }
  return false;
};

/**
 * Handles a new transaction event.
 * @param {object} params - Transaction parameters.
 * @returns {Promise<boolean>} Returns a Promise that resolves to true if the transaction is successfully processed, false otherwise.
 */
export const handleNewTransaction = async (params) => {
  try {
    const db = await Database.getInstance();

    // Retrieve sender information from the "users" collection
    const senderInformation = await db
      .collection(USERS_TEST_COLLECTION)
      .findOne({ userTelegramID: params.senderTgId });

    const recipientWallet = await getPatchWalletAddressFromTgId(
      params.recipientTgId
    );

    const tx = await sendTokens(
      params.senderTgId,
      recipientWallet,
      params.amount.toString(),
      await getPatchWalletAccessToken()
    );

    if (tx.data.txHash) {
      const dateAdded = new Date();

      // Add the reward to the "rewards" collection
      await db.collection(TRANSFERS_TEST_COLLECTION).insertOne({
        TxId: tx.data.txHash.substring(1, 8),
        chainId: "eip155:137",
        tokenSymbol: "g1",
        tokenAddress: process.env.G1_POLYGON_ADDRESS,
        senderTgId: params.senderTgId,
        senderWallet: senderInformation.patchwallet,
        senderName: senderInformation.userName,
        recipientTgId: params.recipientTgId,
        recipientWallet: recipientWallet,
        tokenAmount: params.amount.toString(),
        transactionHash: tx.data.txHash,
        dateAdded: dateAdded,
      });

      await addTrackSegment({
        userTelegramID: params.senderTgId,
        TxId: tx.data.txHash.substring(1, 8),
        senderTgId: params.senderTgId,
        senderWallet: senderInformation.patchwallet,
        senderName: senderInformation.userName,
        recipientTgId: params.recipientTgId,
        recipientWallet: recipientWallet,
        tokenAmount: params.amount.toString(),
        transactionHash: tx.data.txHash,
        dateAdded: dateAdded,
      });

      await axios.post(process.env.FLOWXO_NEW_TRANSACTION_WEBHOOK, {
        senderResponsePath: senderInformation.responsePath,
        TxId: tx.data.txHash.substring(1, 8),
        chainId: "eip155:137",
        tokenSymbol: "g1",
        tokenAddress: process.env.G1_POLYGON_ADDRESS,
        senderTgId: params.senderTgId,
        senderWallet: senderInformation.patchwallet,
        senderName: senderInformation.userName,
        recipientTgId: params.recipientTgId,
        recipientWallet: recipientWallet,
        tokenAmount: params.amount.toString(),
        transactionHash: tx.data.txHash,
        dateAdded: dateAdded,
      });

      console.log(
        `[${tx.data.txHash}] transaction from ${params.senderTgId} to ${
          params.recipientTgId
        } for ${params.amount.toString()} added.`
      );
      return true;
    }
  } catch (error) {
    console.error("Error processing transaction event:", error);
  }
  return false;
};