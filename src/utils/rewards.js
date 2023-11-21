import { Database } from '../db/conn.js';
import { REWARDS_COLLECTION, TRANSACTION_STATUS } from './constants.js';
import 'dotenv/config';
import {
  getPatchWalletAccessToken,
  getTxStatus,
  sendTokens,
} from './patchwallet.js';
import axios from 'axios';

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
 * Represents a Telegram transfer.
 */
export class SignUpRewardTelegram {
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

    this.isInDatabase = false;
    this.tx = undefined;
    this.status = undefined;
    this.txHash = undefined;
    this.userOpHash = undefined;
  }

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

  async getRewardFromDatabase() {
    return await this.db.collection(REWARDS_COLLECTION).findOne({
      userTelegramID: this.userTelegramID,
      eventId: this.eventId,
      reason: 'user_sign_up',
    });
  }

  async getOtherRewardFromDatabase() {
    return await this.db.collection(REWARDS_COLLECTION).findOne({
      userTelegramID: this.userTelegramID,
      eventId: { $ne: this.eventId },
      reason: 'user_sign_up',
    });
  }

  async updateInDatabase(status, date) {
    await this.db.collection(REWARDS_COLLECTION).updateOne(
      { eventId: this.eventId },
      {
        $set: {
          eventId: this.eventId,
          userTelegramID: this.userTelegramID,
          responsePath: this.responsePath,
          userHandle: this.userHandle,
          userName: this.userName,
          reason: 'user_sign_up',
          walletAddress: this.patchwallet,
          amount: '100',
          message: 'Sign up reward',
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

  updateTxHash(txHash) {
    return (this.txHash = txHash);
  }

  updateUserOpHash(userOpHash) {
    return (this.userOpHash = userOpHash);
  }

  isSuccess() {
    return this.status === TRANSACTION_STATUS.SUCCESS;
  }

  isFailure() {
    return this.status === TRANSACTION_STATUS.FAILURE;
  }

  isPendingHash() {
    return this.status === TRANSACTION_STATUS.PENDING_HASH;
  }

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

  async saveToFlowXO() {
    // Send transaction information to FlowXO
    await axios.post(process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK, {
      userTelegramID: this.userTelegramID,
      responsePath: this.responsePath,
      walletAddress: this.patchwallet,
      reason: 'user_sign_up',
      userHandle: this.userHandle,
      userName: this.userName,
      amount: '100',
      message: 'Sign up reward',
      transactionHash: this.txHash,
      dateAdded: new Date(),
    });
  }

  async sendTx() {
    try {
      // Send tokens using PatchWallet
      return await sendTokens(
        process.env.SOURCE_TG_ID,
        this.patchwallet,
        '100',
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
