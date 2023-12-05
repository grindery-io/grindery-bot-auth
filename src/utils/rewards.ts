import { Database } from '../db/conn';
import {
  REWARDS_COLLECTION,
  TRANSACTION_STATUS,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
} from './constants';
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  sendTokens,
} from './patchwallet';
import axios from 'axios';
import {
  FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK,
  FLOWXO_NEW_LINK_REWARD_WEBHOOK,
  FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK,
  FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK,
  G1_POLYGON_ADDRESS,
  SOURCE_TG_ID,
} from '../../secrets';
import { isSuccessfulTransaction } from './webhooks/utils';
import { Db, Document, FindCursor, WithId } from 'mongodb';

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
  eventId: string,
  userTelegramID: string,
  responsePath: string,
  userHandle: string,
  userName: string,
  patchwallet: string,
  tokenAddress: string,
  chainName: string,
): Promise<SignUpRewardTelegram | boolean> {
  const reward = new SignUpRewardTelegram(
    eventId,
    userTelegramID,
    responsePath,
    userHandle,
    userName,
    patchwallet,
    tokenAddress,
    chainName,
  );

  if (!(await reward.initializeRewardDatabase())) return false;

  return reward;
}

/**
 * Represents a Telegram sign-up reward.
 */
export class SignUpRewardTelegram {
  eventId: string;
  userTelegramID: string;
  responsePath: string;
  userHandle: string;
  userName: string;
  patchwallet: string;
  tokenAddress: string;
  chainName: string;

  reason: string = 'user_sign_up';
  amount: string = '100';
  message: string = 'Sign up reward';

  isInDatabase: boolean = false;
  tx?: WithId<Document>;
  status?: string;
  txHash?: string;
  userOpHash?: string;
  db?: Db;

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
    eventId: string,
    userTelegramID: string,
    responsePath: string,
    userHandle: string,
    userName: string,
    patchwallet: string,
    tokenAddress: string,
    chainName: string,
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

    (this.tokenAddress = tokenAddress ? tokenAddress : G1_POLYGON_ADDRESS),
      (this.chainName = chainName ? chainName : 'matic');
  }

  /**
   * Initializes the sign-up reward object by connecting to the database and retrieving relevant information.
   * @returns {Promise<boolean>} - True if initialization is successful, false otherwise.
   */
  async initializeRewardDatabase(): Promise<boolean> {
    this.db = await Database.getInstance();
    this.tx = await this.getRewardFromDatabase();

    if (await this.getOtherRewardFromDatabase()) return false;

    if (this.tx) {
      this.isInDatabase = true;
      this.status = this.tx.status;
      this.userOpHash = this.tx.userOpHash;

      if (isSuccessfulTransaction(this.status)) return false;
    } else {
      await this.updateInDatabase(TRANSACTION_STATUS.PENDING, new Date());
    }

    return true;
  }

  /**
   * Retrieves the status of the PatchWallet transaction.
   * @returns {Promise<boolean>} - True if the transaction status is retrieved successfully, false otherwise.
   */
  async getRewardFromDatabase(): Promise<WithId<Document>> {
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
  async getOtherRewardFromDatabase(): Promise<object | null> {
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
  async updateInDatabase(status: string, date: Date | null) {
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
      { upsert: true },
    );
    console.log(
      `[${this.eventId}] sign up reward for ${this.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO(): Promise<void> {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK, {
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
   * @returns {Promise<any>} - True if the tokens are sent successfully, false otherwise.
   */
  async sendTx(): Promise<any> {
    try {
      // Send tokens using PatchWallet
      return await sendTokens(
        SOURCE_TG_ID,
        this.patchwallet,
        this.amount,
        await getPatchWalletAccessToken(),
        this.tokenAddress,
        this.chainName,
      );
    } catch (error) {
      // Log error if sending tokens fails
      console.error(
        `[${this.eventId}] sign up reward for ${this.userTelegramID} - Error processing PatchWallet token sending: ${error}`,
      );

      return false;
    }
  }

  async getOtherOnHoldRewardFromDatabase(): Promise<object | null> {
    return await this.db.collection(REWARDS_COLLECTION).findOne({
      userTelegramID: this.userTelegramID,
      eventId: { $ne: this.eventId },
      reason: this.reason,
      status: TRANSACTION_STATUS.ON_HOLD
    });
  }
}

/**
 * Creates a ReferralRewardTelegram instance and initializes reward database.
 *
 * This function initializes a referral reward for a Telegram user based on the provided parameters.
 * It creates an instance of ReferralRewardTelegram and initializes the reward database by connecting to it.
 *
 * @param {string} eventId - The ID of the event associated with the referral reward.
 * @param {string} userTelegramID - The Telegram ID of the user.
 * @param {string} responsePath - The response path for the reward.
 * @param {string} userHandle - The handle of the user.
 * @param {string} userName - The name of the user.
 * @param {string} patchwallet - The PatchWallet details for the reward.
 * @param {string} tokenAddress - The token address for the reward.
 * @param {string} chainName - The blockchain name for the reward.
 * @returns {Promise<ReferralRewardTelegram>} - The created ReferralRewardTelegram instance with initialized reward database.
 */
export async function createReferralRewardTelegram(
  eventId: string,
  userTelegramID: string,
  responsePath: string,
  userHandle: string,
  userName: string,
  patchwallet: string,
  tokenAddress: string,
  chainName: string,
): Promise<ReferralRewardTelegram> {
  // Create a new instance of ReferralRewardTelegram
  const reward = new ReferralRewardTelegram(
    eventId,
    userTelegramID,
    responsePath,
    userHandle,
    userName,
    patchwallet,
    tokenAddress,
    chainName,
  );

  // Initialize the reward database by connecting and retrieving necessary information
  await reward.initializeRewardDatabase();

  return reward;
}

/**
 * Represents a Telegram referral reward.
 */
export class ReferralRewardTelegram {
  eventId: string;
  userTelegramID: string;
  responsePath: string;
  userHandle: string;
  userName: string;
  patchwallet: string;
  tokenAddress: string;
  chainName: string;

  reason: string = '2x_reward';
  amount: string = '50';
  message: string = 'Referral reward';

  parentTx?: WithId<Document>;
  referent?: WithId<Document>;
  tx?: WithId<Document>;
  status?: string;
  txHash?: string;
  userOpHash?: string;
  db?: Db;
  transfers?: FindCursor<WithId<Document>>;

  /**
   * Constructs a ReferralRewardTelegram object.
   * @param {string} eventId - The event ID.
   * @param {string} userTelegramID - The user's Telegram ID.
   * @param {string} responsePath - The response path.
   * @param {string} userHandle - The user's handle.
   * @param {string} userName - The user's name.
   * @param {string} patchwallet - The user's PatchWallet address.
   * @param {string} tokenAddress - The token address for the reward.
   * @param {string} chainName - The blockchain name.
   */
  constructor(
    eventId: string,
    userTelegramID: string,
    responsePath: string,
    userHandle: string,
    userName: string,
    patchwallet: string,
    tokenAddress: string,
    chainName: string,
  ) {
    // Properties related to user and reward details
    this.eventId = eventId;
    this.userTelegramID = userTelegramID;
    this.responsePath = responsePath;
    this.userHandle = userHandle;
    this.userName = userName;
    this.patchwallet = patchwallet;
    this.tokenAddress = tokenAddress ? tokenAddress : G1_POLYGON_ADDRESS;
    this.chainName = chainName ? chainName : 'matic';

    // Reward-specific details
    this.reason = '2x_reward';
    this.amount = '50';
    this.message = 'Referral reward';

    // Properties to be initialized
    this.parentTx = undefined;
    this.referent = undefined;
    this.tx = undefined;
    this.status = undefined;
    this.txHash = undefined;
    this.userOpHash = undefined;
  }

  /**
   * Initializes the reward database by connecting to the database and retrieving necessary information.
   */
  async initializeRewardDatabase() {
    this.db = await Database.getInstance();
    this.transfers = await this.getTransfersFromDatabase();
  }

  /**
   * Retrieves transfers from the database based on certain conditions.
   * @returns {Promise<FindCursor<WithId<Document>>>} - The retrieved transfers.
   */
  async getTransfersFromDatabase(): Promise<FindCursor<WithId<Document>>> {
    return this.db.collection(TRANSFERS_COLLECTION).find({
      senderTgId: { $ne: this.userTelegramID },
      recipientTgId: this.userTelegramID,
    });
  }

  /**
   * Sets the parent transaction based on certain conditions from the retrieved transfers.
   * @returns {Promise<boolean>} - True if the parent transaction is set successfully, false otherwise.
   */
  async setParentTx(): Promise<boolean> {
    for await (const transfer of this.transfers) {
      if (!this.parentTx || transfer.dateAdded < this.parentTx.dateAdded) {
        this.parentTx = transfer;
      }
    }

    if (!this.parentTx) {
      console.log(
        `[${this.eventId}] no referral reward to distribute with ${this.userTelegramID} as a new user.`,
      );
      return false;
    }

    return true;
  }

  /**
   * Retrieves information about the referent user from the database.
   * @returns {Promise<boolean>} - True if referent information is retrieved successfully, false otherwise.
   */
  async getReferent(): Promise<boolean> {
    try {
      this.referent = await this.db.collection(USERS_COLLECTION).findOne({
        userTelegramID: this.parentTx.senderTgId,
      });
      if (!this.referent) {
        console.log(
          `[${this.eventId}] sender ${this.parentTx.senderTgId} who is supposed to receive a referral reward is not a user.`,
        );
      }
      return Boolean(this.referent);
    } catch (error) {
      console.error(
        `[${this.eventId}] Error trying to get referent information: ${error}`,
      );
      return false;
    }
  }

  /**
   * Retrieves the referral reward from the database based on the event ID and reason.
   * @returns {Promise<boolean>} - True if the referral reward is retrieved successfully, false otherwise.
   */
  async getRewardSameFromDatabase(): Promise<boolean> {
    this.tx = await this.db.collection(REWARDS_COLLECTION).findOne({
      eventId: this.eventId,
      reason: this.reason,
    });

    if (this.tx) {
      this.userOpHash = this.tx.userOpHash;
      this.status = this.tx.status;
    }

    return Boolean(this.tx);
  }

  /**
   * Retrieves referral reward information from the database with a different event ID, user ID, and new user address.
   * @returns {Promise<boolean>} - True if the referral reward information is retrieved successfully, false otherwise.
   */
  async getRewardFromDatabaseWithOtherEventId(): Promise<boolean> {
    return Boolean(
      await this.db.collection(REWARDS_COLLECTION).findOne({
        eventId: { $ne: this.eventId },
        reason: this.reason,
        userTelegramID: this.referent.userTelegramID,
        newUserAddress: this.patchwallet,
      }),
    );
  }

  /**
   * Updates the PatchWallet address of the referent user for the referral reward.
   */
  async updateReferentWallet() {
    this.referent.patchwallet =
      this.referent?.patchwallet ??
      (await getPatchWalletAddressFromTgId(this.referent.userTelegramID));
  }

  /**
   * Updates the referral reward information in the database.
   * @param {string} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(status: string, date: Date | null) {
    await this.db.collection(REWARDS_COLLECTION).updateOne(
      {
        eventId: this.eventId,
        reason: this.reason,
      },
      {
        $set: {
          eventId: this.eventId,
          userTelegramID: this.referent.userTelegramID,
          responsePath: this.referent.responsePath,
          userHandle: this.referent.userHandle,
          userName: this.referent.userName,
          reason: this.reason,
          walletAddress: this.referent.patchwallet,
          amount: this.amount,
          message: this.message,
          ...(date !== null ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
          status: status,
          newUserAddress: this.patchwallet,
          parentTransactionHash: this.parentTx.transactionHash,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.eventId}] referral reward for ${this.referent.patchwallet} sending tokens to ${this.patchwallet} in ${this.parentTx.transactionHash} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves referral reward transaction information to FlowXO.
   */
  async saveToFlowXO() {
    await axios.post(FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK, {
      newUserTgId: this.userTelegramID,
      newUserResponsePath: this.responsePath,
      newUserUserHandle: this.userHandle,
      newUserUserName: this.userName,
      newUserPatchwallet: this.patchwallet,
      userTelegramID: this.referent.userTelegramID,
      responsePath: this.referent.responsePath,
      walletAddress: this.referent.patchwallet,
      reason: this.reason,
      userHandle: this.referent.userHandle,
      userName: this.referent.userName,
      amount: this.amount,
      message: this.message,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      parentTransactionHash: this.parentTx.transactionHash,
    });
  }

  /**
   * Sends tokens for the referral reward using PatchWallet.
   * @returns {Promise<any>} - True if the tokens are sent successfully, false otherwise.
   */
  async sendTx(): Promise<any> {
    try {
      return await sendTokens(
        SOURCE_TG_ID,
        this.referent.patchwallet,
        this.amount,
        await getPatchWalletAccessToken(),
        this.tokenAddress,
        this.chainName,
      );
    } catch (error) {
      console.error(
        `[${this.eventId}] Error processing PatchWallet referral reward for ${this.referent.patchwallet}: ${error}`,
      );

      return false;
    }
  }
}

/**
 * Creates a Link Reward Telegram instance after initializing its reward database.
 * @param {string} eventId - The event ID.
 * @param {string} userTelegramID - The user's Telegram ID.
 * @param {string} referentUserTelegramID - The referent's Telegram ID.
 * @param {string} tokenAddress - The token address.
 * @param {string} chainName - The blockchain name.
 * @returns {Promise<LinkRewardTelegram|boolean>} - A LinkRewardTelegram instance if initialization is successful, otherwise returns false.
 */
export async function createLinkRewardTelegram(
  eventId: string,
  userTelegramID: string,
  referentUserTelegramID: string,
  tokenAddress: string,
  chainName: string,
): Promise<LinkRewardTelegram | boolean> {
  const reward = new LinkRewardTelegram(
    eventId,
    userTelegramID,
    referentUserTelegramID,
    tokenAddress,
    chainName,
  );

  if (!(await reward.initializeRewardDatabase())) return false;

  return reward;
}

/**
 * Represents a link reward for Telegram users.
 */
export class LinkRewardTelegram {
  eventId: string;
  userTelegramID: string;
  referentUserTelegramID: string;
  tokenAddress: string;
  chainName: string;

  reason: string = 'referral_link';
  amount: string = '10';
  message: string = 'Referral link';

  isInDatabase: boolean = false;
  tx?: WithId<Document>;
  status?: string;
  txHash?: string;
  userOpHash?: string;
  referent?: WithId<Document>;
  db?: Db;

  /**
   * Constructor for LinkRewardTelegram class.
   * @param {string} eventId - The event ID.
   * @param {string} userTelegramID - The user's Telegram ID.
   * @param {string} referentUserTelegramID - The referent's Telegram ID.
   * @param {string} tokenAddress - The token address.
   * @param {string} chainName - The blockchain name.
   */
  constructor(
    eventId: string,
    userTelegramID: string,
    referentUserTelegramID: string,
    tokenAddress: string,
    chainName: string,
  ) {
    // Properties related to user and reward details
    this.eventId = eventId;
    this.userTelegramID = userTelegramID;
    this.referentUserTelegramID = referentUserTelegramID;
    this.tokenAddress = tokenAddress ? tokenAddress : G1_POLYGON_ADDRESS;
    this.chainName = chainName ? chainName : 'matic';

    // Reward-specific details
    this.reason = 'referral_link';
    this.amount = '10';
    this.message = 'Referral link';

    // Properties to be initialized
    this.tx = undefined;
    this.status = undefined;
    this.txHash = undefined;
    this.userOpHash = undefined;
    this.referent = undefined;
  }

  /**
   * Initializes the reward database by connecting to the database and retrieving necessary information.
   * @returns {Promise<boolean>} - True if initialization is successful, false otherwise.
   */
  async initializeRewardDatabase(): Promise<boolean> {
    this.db = await Database.getInstance();

    if (!(await this.getReferent())) {
      console.log(
        `[${this.eventId}] ${this.referentUserTelegramID} referent user is not a user to process the link reward.`,
      );
      return false;
    }

    this.tx = await this.getRewardFromDatabase();

    if (await this.getOtherRewardFromDatabase()) return false;

    if (this.tx) {
      this.isInDatabase = true;
      this.status = this.tx.status;
      this.userOpHash = this.tx.userOpHash;

      if (isSuccessfulTransaction(this.status)) return false;
    } else {
      await this.updateInDatabase(TRANSACTION_STATUS.PENDING, new Date());
    }

    return true;
  }

  /**
   * Retrieves the referent user information from the database.
   * @returns {Promise<object|null>} - The referent user information or null if not found.
   */
  async getReferent(): Promise<object | null> {
    this.referent = await this.db
      .collection(USERS_COLLECTION)
      .findOne({ userTelegramID: this.referentUserTelegramID });

    this.referent.patchwallet =
      this.referent?.patchwallet ??
      (await getPatchWalletAddressFromTgId(this.referentUserTelegramID));
    return this.referent;
  }

  /**
   * Retrieves the reward information from the database.
   * @returns {Promise<WithId<Document>>} - The reward information or null if not found.
   */
  async getRewardFromDatabase(): Promise<WithId<Document>> {
    return await this.db.collection(REWARDS_COLLECTION).findOne({
      eventId: this.eventId,
      userTelegramID: this.referentUserTelegramID,
      sponsoredUserTelegramID: this.userTelegramID,
      reason: this.reason,
    });
  }

  /**
   * Retrieves other reward information from the database for a different event.
   * @returns {Promise<object|null>} - The reward information or null if not found.
   */
  async getOtherRewardFromDatabase(): Promise<object | null> {
    return await this.db.collection(REWARDS_COLLECTION).findOne({
      sponsoredUserTelegramID: this.userTelegramID,
      reason: this.reason,
      eventId: { $ne: this.eventId },
    });
  }

  /**
   * Updates the reward information in the database.
   * @param {string} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(status: string, date: Date | null) {
    await this.db.collection(REWARDS_COLLECTION).updateOne(
      {
        eventId: this.eventId,
        reason: this.reason,
        userTelegramID: this.referentUserTelegramID,
      },
      {
        $set: {
          eventId: this.eventId,
          userTelegramID: this.referentUserTelegramID,
          responsePath: this.referent.responsePath,
          userHandle: this.referent.userHandle,
          userName: this.referent.userName,
          reason: this.reason,
          walletAddress: this.referent.patchwallet,
          amount: this.amount,
          message: this.message,
          ...(date !== null ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
          status: status,
          sponsoredUserTelegramID: this.userTelegramID,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.eventId}] link for ${this.referentUserTelegramID} sponsoring ${this.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to FlowXO.
   */
  async saveToFlowXO() {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_LINK_REWARD_WEBHOOK, {
      userTelegramID: this.referentUserTelegramID,
      responsePath: this.referent.responsePath,
      walletAddress: this.referent.patchwallet,
      reason: this.reason,
      userHandle: this.referent.userHandle,
      userName: this.referent.userName,
      amount: this.amount,
      message: this.message,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      sponsoredUserTelegramID: this.userTelegramID,
    });
  }

  /**
   * Sends tokens using PatchWallet.
   * @returns {Promise<any>} - True if sending tokens is successful, false otherwise.
   */
  async sendTx(): Promise<any> {
    try {
      // Send tokens using PatchWallet
      return await sendTokens(
        SOURCE_TG_ID,
        this.referent.patchwallet,
        this.amount,
        await getPatchWalletAccessToken(),
        this.tokenAddress,
        this.chainName,
      );
    } catch (error) {
      // Log error if sending tokens fails
      console.error(
        `[${this.eventId}] link reward for ${this.referentUserTelegramID} - Error processing PatchWallet token sending: ${error}`,
      );

      return false;
    }
  }
}

/**
 * Creates an isolated reward for Telegram users.
 * @param {string} eventId - The unique identifier for the event transaction.
 * @param {string} userTelegramID - The Telegram user ID associated with the reward.
 * @param {string} reason - The reason for the reward.
 * @param {number} amount - The amount involved in the reward.
 * @param {string} message - A message associated with the reward.
 * @param {string} responsePath - The response path for the reward.
 * @param {string} userHandle - The user handle associated with the reward.
 * @param {string} userName - The name of the user receiving the reward.
 * @param {string} patchwallet - The patch wallet information.
 * @param {string} tokenAddress - The address of the token used in the reward.
 * @param {string} chainName - The name of the blockchain network.
 * @returns {Promise<IsolatedRewardTelegram|boolean>} - Returns an instance of IsolatedRewardTelegram if successful, otherwise false.
 */
export async function createIsolatedRewardTelegram(
  eventId: string,
  userTelegramID: string,
  reason: string,
  amount: string,
  message: string,
  responsePath: string,
  userHandle: string,
  userName: string,
  patchwallet: string,
  tokenAddress: string,
  chainName: string,
): Promise<IsolatedRewardTelegram | boolean> {
  const reward = new IsolatedRewardTelegram(
    eventId,
    userTelegramID,
    reason,
    amount,
    message,
    responsePath,
    userHandle,
    userName,
    patchwallet,
    tokenAddress,
    chainName,
  );

  if (!(await reward.initializeRewardDatabase())) return false;

  return reward;
}

export class IsolatedRewardTelegram {
  eventId: string;
  userTelegramID: string;
  responsePath: string;
  userHandle: string;
  userName: string;
  patchwallet: string;
  reason: string;
  amount: string;
  message: string;
  isInDatabase: boolean = false;
  tx?: WithId<Document>;
  status?: string;
  txHash?: string;
  db?: Db;
  userOpHash?: string;
  tokenAddress: string;
  chainName: string;

  /**
   * Constructs a new instance of an EventTransaction.
   * @param {string} eventId - The unique identifier for the event transaction.
   * @param {string} userTelegramID - The Telegram user ID associated with the transaction.
   * @param {string} reason - The reason for the transaction.
   * @param {string} amount - The amount involved in the transaction.
   * @param {string} message - A message associated with the transaction.
   * @param {string} responsePath - The response path for the transaction.
   * @param {string} userHandle - The user handle associated with the transaction.
   * @param {string} userName - The name of the user initiating the transaction.
   * @param {string} patchwallet - The patch wallet information.
   * @param {string} tokenAddress - The address of the token used in the transaction (default: G1_POLYGON_ADDRESS).
   * @param {string} chainName - The name of the blockchain network (default: 'matic').
   */
  constructor(
    eventId: string,
    userTelegramID: string,
    reason: string,
    amount: string,
    message: string,
    responsePath: string,
    userHandle: string,
    userName: string,
    patchwallet: string,
    tokenAddress: string,
    chainName: string,
  ) {
    this.eventId = eventId;
    this.userTelegramID = userTelegramID;
    this.responsePath = responsePath;
    this.userHandle = userHandle;
    this.userName = userName;
    this.patchwallet = patchwallet;

    this.reason = reason;
    this.amount = amount;
    this.message = message;

    this.isInDatabase = false;
    this.tx = undefined;
    this.status = undefined;
    this.txHash = undefined;
    this.userOpHash = undefined;

    this.tokenAddress = tokenAddress ? tokenAddress : G1_POLYGON_ADDRESS;
    this.chainName = chainName ? chainName : 'matic';
  }

  /**
   * Initializes the isolated reward object by connecting to the database and retrieving relevant information.
   * @returns {Promise<boolean>} - True if initialization is successful, false otherwise.
   */
  async initializeRewardDatabase(): Promise<boolean> {
    this.db = await Database.getInstance();
    this.patchwallet =
      this.patchwallet ??
      (await getPatchWalletAddressFromTgId(this.userTelegramID));
    this.tx = await this.getRewardFromDatabase();

    if (await this.getOtherRewardFromDatabase()) return false;

    if (this.tx) {
      this.isInDatabase = true;
      this.status = this.tx.status;
      this.userOpHash = this.tx.userOpHash;

      if (isSuccessfulTransaction(this.status)) return false;
    } else {
      await this.updateInDatabase(TRANSACTION_STATUS.PENDING, new Date());
    }

    return true;
  }

  /**
   * Retrieves the status of the PatchWallet transaction.
   * @returns {Promise<WithId<Document>>} - True if the transaction status is retrieved successfully, false otherwise.
   */
  async getRewardFromDatabase(): Promise<WithId<Document>> {
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
  async getOtherRewardFromDatabase(): Promise<object | null> {
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
  async updateInDatabase(status: string, date: Date | null) {
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
      { upsert: true },
    );
    console.log(
      `[${this.eventId}] sign up reward for ${this.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO(): Promise<void> {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK, {
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
  async sendTx(): Promise<any> {
    try {
      // Send tokens using PatchWallet
      return await sendTokens(
        SOURCE_TG_ID,
        this.patchwallet,
        this.amount,
        await getPatchWalletAccessToken(),
        this.tokenAddress,
        this.chainName,
      );
    } catch (error) {
      // Log error if sending tokens fails
      console.error(
        `[${this.eventId}] sign up reward for ${this.userTelegramID} - Error processing PatchWallet token sending: ${error}`,
      );

      return false;
    }
  }
}
