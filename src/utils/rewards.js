import { Database } from '../db/conn.js';
import { REWARDS_COLLECTION, TRANSACTION_STATUS } from './constants.js';
import 'dotenv/config';
import {
  getPatchWalletAccessToken,
  getTxStatus,
  sendTokens,
} from './patchwallet.js';
import axios from 'axios';

/**
 * Asynchronously creates a sign-up reward for Telegram users.
 *
 * This function initializes a sign-up reward for a Telegram user based on provided parameters.
 * It creates an instance of SignUpRewardTelegram and initializes the reward database.
 *
 * @param {string} eventId - The ID of the event associated with the sign-up reward.
 * @param {string} userTelegramID - The Telegram ID of the user.
 * @param {string} responsePath - The response path for the reward.
 * @param {string} userHandle - The handle of the user.
 * @param {string} userName - The name of the user.
 * @param {string} patchwallet - The patchwallet details for the reward.
 * @returns {Promise<SignUpRewardTelegram|boolean>} The created sign-up reward instance if successful,
 *                                                  or `false` if initialization fails.
 */
export async function createSignUpRewardTelegram(
  eventId,
  userTelegramID,
  responsePath,
  userHandle,
  userName,
  patchwallet
) {
  const reward = new SignUpRewardTelegram(
    eventId,
    userTelegramID,
    responsePath,
    userHandle,
    userName,
    patchwallet
  );

  if (!(await reward.initializeRewardDatabase())) return false;

  return reward;
}

/**
 * Represents a Telegram sign-up reward.
 */
export class SignUpRewardTelegram {
  /**
   * Constructor for SignUpRewardTelegram class.
   * @param {string} eventId - The event ID.
   * @param {string} userTelegramID - The user's Telegram ID.
   * @param {string} responsePath - The response path.
   * @param {string} userHandle - The user's handle.
   * @param {string} userName - The user's name.
   * @param {string} patchwallet - The user's PatchWallet address.
   */
  constructor(
    eventId,
    userTelegramID,
    responsePath,
    userHandle,
    userName,
    patchwallet
  ) {
    this.eventId = eventId;
    this.userTelegramID = userTelegramID;
    this.responsePath = responsePath;
    this.userHandle = userHandle;
    this.userName = userName;
    this.patchwallet = patchwallet;

    this.reason = 'user_sign_up';
    this.amount = '100';
    this.message = 'Sign up reward';

    this.isInDatabase = false;
    this.tx = undefined;
    this.status = undefined;
    this.txHash = undefined;
    this.userOpHash = undefined;
  }

  /**
   * Initializes the sign-up reward object by connecting to the database and retrieving relevant information.
   * @returns {Promise<boolean>} - True if initialization is successful, false otherwise.
   */
  async initializeRewardDatabase() {
    this.db = await Database.getInstance();
    this.tx = await this.getRewardFromDatabase();

    if (await this.getOtherRewardFromDatabase()) return false;

    if (this.tx) {
      this.isInDatabase = true;
      this.status = this.tx.status;
      this.userOpHash = this.tx.userOpHash;

      if (this.isSuccess()) return false;
    } else {
      await this.updateInDatabase(TRANSACTION_STATUS.PENDING, new Date());
    }

    return true;
  }

  /**
   * Retrieves the status of the PatchWallet transaction.
   * @returns {Promise<boolean>} - True if the transaction status is retrieved successfully, false otherwise.
   */
  async getRewardFromDatabase() {
    return await this.db.collection(REWARDS_COLLECTION).findOne({
      userTelegramID: this.userTelegramID,
      eventId: this.eventId,
      reason: this.reason,
    });
  }

  /**
   * Retrieves other reward information from the database for the same user but different event.
   * @returns {Promise<object|null>} - The reward information or null if not found.
   */
  async getOtherRewardFromDatabase() {
    return await this.db.collection(REWARDS_COLLECTION).findOne({
      userTelegramID: this.userTelegramID,
      eventId: { $ne: this.eventId },
      reason: this.reason,
    });
  }

  /**
   * Updates the reward information in the database.
   * @param {string} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(status, date) {
    await this.db.collection(REWARDS_COLLECTION).updateOne(
      {
        eventId: this.eventId,
        reason: this.reason,
        userTelegramID: this.userTelegramID,
      },
      {
        $set: {
          eventId: this.eventId,
          userTelegramID: this.userTelegramID,
          responsePath: this.responsePath,
          userHandle: this.userHandle,
          userName: this.userName,
          reason: this.reason,
          walletAddress: this.patchwallet,
          amount: this.amount,
          message: this.message,
          ...(date !== null ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
          status: status,
        },
      },
      { upsert: true }
    );
    console.log(
      `[${this.eventId}] sign up reward for ${this.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`
    );
  }

  /**
   * Checks if the treatment duration has exceeded the limit.
   * @returns {Promise<boolean>} - True if the treatment duration has exceeded, false otherwise.
   */
  async isTreatmentDurationExceeded() {
    return (
      (this.tx.dateAdded < new Date(new Date() - 10 * 60 * 1000) &&
        (console.log(
          `[${this.eventId}] was stopped due to too long treatment duration (> 10 min).`
        ),
        await this.updateInDatabase(TRANSACTION_STATUS.FAILURE, new Date()),
        true)) ||
      false
    );
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
   * Checks if the transaction is successful.
   * @returns {boolean} - True if the transaction is successful, false otherwise.
   */
  isSuccess() {
    return this.status === TRANSACTION_STATUS.SUCCESS;
  }

  /**
   * Checks if the transaction has failed.
   * @returns {boolean} - True if the transaction has failed, false otherwise.
   */
  isFailure() {
    return this.status === TRANSACTION_STATUS.FAILURE;
  }

  /**
   * Checks if the transaction is in the pending hash state.
   * @returns {boolean} - True if the transaction is in the pending hash state, false otherwise.
   */
  isPendingHash() {
    return this.status === TRANSACTION_STATUS.PENDING_HASH;
  }

  /**
   * Retrieves the status of the PatchWallet transaction.
   * @returns {Promise<boolean>} - True if the transaction status is retrieved successfully, false otherwise.
   */
  async getStatus() {
    try {
      // Retrieve the status of the PatchWallet transaction
      return await getTxStatus(this.userOpHash);
    } catch (error) {
      // Log error if retrieving transaction status fails
      console.error(
        `[${this.eventId}] Error processing PatchWallet transaction status: ${error}`
      );
      // Return true if the error status is 470, marking the transaction as failed
      return false;
    }
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<object|undefined>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO() {
    // Send transaction information to FlowXO
    await axios.post(process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK, {
      userTelegramID: this.userTelegramID,
      responsePath: this.responsePath,
      walletAddress: this.patchwallet,
      reason: this.reason,
      userHandle: this.userHandle,
      userName: this.userName,
      amount: this.amount,
      message: this.message,
      transactionHash: this.txHash,
      dateAdded: new Date(),
    });
  }

  /**
   * Sends tokens using PatchWallet.
   * @returns {Promise<boolean>} - True if the tokens are sent successfully, false otherwise.
   */
  async sendTx() {
    try {
      // Send tokens using PatchWallet
      return await sendTokens(
        process.env.SOURCE_TG_ID,
        this.patchwallet,
        this.amount,
        await getPatchWalletAccessToken()
      );
    } catch (error) {
      // Log error if sending tokens fails
      console.error(
        `[${this.eventId}] sign up reward for ${this.userTelegramID} - Error processing PatchWallet token sending: ${error}`
      );

      return false;
    }
  }
}
