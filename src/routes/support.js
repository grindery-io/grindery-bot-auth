import express from "express";
import { Database } from "../db/conn.js";
import { authenticateApiKey } from "../utils/auth.js";
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  sendTokens,
} from "../utils/patchwallet.js";
import ERC20 from "./abi/ERC20.json" assert { type: "json" };
import Web3 from "web3";
import axios from "axios";

const router = express.Router();

/**
 * POST /import
 *
 * @summary Import users into the database
 * @description Import a list of users into the database. Each user should contain necessary fields. This endpoint will reject the insertion if a user already exists in the database or if mandatory fields are missing.
 * @tags Users
 * @param {object[]} request.body - The list of users to import.
 * @return {object} 201 - Success response with inserted data
 * @return {object} 400 - Error response when payload is not iterable, a user already exists, or no valid data to insert
 * @example request - 201 - Example request body
 * [
 *   {
 *     "UserID": "1",
 *     "FirstName": "John",
 *     "UserHandle": "@john_doe",
 *     "ResponsePath": "some/path/to/response",
 *     "wallet": "0xABCDEF0123456789"
 *   },
 *   {
 *     "UserID": "2",
 *     "FirstName": "John 2",
 *     "UserHandle": "@john_doe2",
 *     "ResponsePath": "some/path/to/response",
 *     "wallet": "0xBCCDEF01234567892"
 *   }
 * ]
 * @example response - 201 - Success response example
 * {
 *   "acknowledged": true,
 *   "insertedCount": 1,
 *   "insertedIds": {
 *      "0": "64f660748761f590a01767e7"
 *   }
 * }
 * @example response - 400 - Error response example when user already exists
 * {
 *   "message": "User 123456789 already registed or fields not filled"
 * }
 * @example response - 400 - Error response example when payload is not iterable
 * {
 *   "message": "Payload is not iterable"
 * }
 */
router.post("/import", authenticateApiKey, async (req, res) => {
  const db = await Database.getInstance(req);
  const collection = db.collection("users");
  const inputData = req.body;
  const toInsert = [];

  if (!Array.isArray(inputData)) {
    return res.status(400).send({
      message: "Payload is not iterable",
    });
  }

  // Extract all Telegram IDs from the inputData
  const inputTelegramIDs = inputData.map((entry) => entry.UserID);

  // Fetch all users from DB that match the input IDs
  const existingUsers = await collection
    .find({
      userTelegramID: { $in: inputTelegramIDs },
    })
    .toArray();

  const existingTelegramIDs = existingUsers.map((user) => user.userTelegramID);

  // Filter out the inputData entries that are not in the existing list
  const nonExistingUsers = inputData.filter(
    (entry) => !existingTelegramIDs.includes(entry.UserID)
  );

  // Format the non-existing users for insertion
  nonExistingUsers.forEach((entry) => {
    const userFormatted = {
      userTelegramID: entry.UserID,
      userName: entry.FirstName,
      userHandle: entry.UserHandle,
      responsePath: entry.ResponsePath,
      patchwallet: entry.wallet,
      dateAdded: new Date().toISOString(),
    };
    toInsert.push(userFormatted);
  });

  // Insert the non-existing users to the DB
  if (toInsert.length > 0) {
    const insertedData = await collection.insertMany(toInsert);
    res.status(201).send(insertedData);
  } else {
    res.status(400).send({ message: "No valid data to insert" });
  }
});

router.get(
  "/reward-referral-transactions",
  authenticateApiKey,
  async (req, res) => {
    try {
      // Obtain the access token for the Patch Wallet API
      let patchWalletAccessToken = await getPatchWalletAccessToken();

      // Track the time of the last token renewal
      let lastTokenRenewalTime = Date.now();

      // Connect to the database and retrieve necessary collections
      const db = await Database.getInstance(req);
      const usersCollection = db.collection("users");
      const rewardCollection = db.collection("rewards");

      // Iterate through transactions
      for (const transaction of await db
        .collection("transfers")
        .find({ senderTgId: "1723578990" })
        .toArray()) {
        // Find the recipient user based on their Telegram ID
        const user = await usersCollection.findOne({
          userTelegramID: transaction.recipientTgId,
        });

        // Check if it's time to renew the Patch Wallet access token
        if (Date.now() - lastTokenRenewalTime >= 50 * 60 * 1000) {
          patchWalletAccessToken = await getPatchWalletAccessToken();
          lastTokenRenewalTime = Date.now();
        }

        // Check conditions for issuing a reward to the user
        if (
          user &&
          new Date(user.dateAdded) > new Date(transaction.dateAdded) &&
          !(await rewardCollection.findOne({
            parentTransactionHash: transaction.transactionHash.substring(1, 8),
          })) &&
          transaction.senderWallet != process.env.SOURCE_WALLET_ADDRESS
        ) {
          // Find information about the sender of the transaction
          const sender = await usersCollection.findOne({
            userTelegramID: transaction.senderTgId,
          });

          // Get the recipient's wallet address based on their Telegram ID if not already existing
          const recipientWallet =
            transaction.recipientWallet ??
            (await getPatchWalletAddressFromTgId(transaction.recipientTgId));

          // Send a reward of 50 tokens using the Patch Wallet API
          const txReward = await sendTokens(
            process.env.SOURCE_TG_ID,
            recipientWallet,
            50,
            patchWalletAccessToken
          );

          // Log the issuance of the reward and insert the record into the collection
          await rewardCollection.insertOne({
            userTelegramID: transaction.senderTgId,
            responsePath: sender.responsePath,
            walletAddress: recipientWallet,
            reason: "2x_reward",
            userHandle: sender.userHandle,
            userName: sender.userName,
            amount: "50",
            message:
              "Thank you for sending tokens. Here is your 50 token reward in Grindery One Tokens.",
            transactionHash: txReward.data.txHash,
            parentTransactionHash: transaction.transactionHash.substring(1, 8),
          });

          console.log(`User ${sender.userTelegramID} has been rewarded.`);
        }
      }

      // Respond with a success message when all referral rewards have been issued
      return res
        .status(200)
        .send({ msg: "All referral rewards have been issued." });
    } catch (error) {
      // Handle errors and return a 500 Internal Server Error response
      return res.status(500).send({
        msg: "An error occurred while analyzing transactions",
        error,
      });
    }
  }
);

export default router;
