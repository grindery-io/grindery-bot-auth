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
import axios, { AxiosError } from 'axios';
import {
  FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK,
  FLOWXO_NEW_LINK_REWARD_WEBHOOK,
  FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK,
  FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK,
  FLOWXO_WEBHOOK_API_KEY,
  SOURCE_TG_ID,
} from '../../secrets';
import { isSuccessfulTransaction } from '../webhooks/utils';
import { Db, Document, FindCursor, WithId } from 'mongodb';
import {
  PatchRawResult,
  RewardParams,
  TransactionStatus,
} from '../types/webhook.types';

/**
 * Creates a sign-up reward specific to Telegram based on the specified parameters.
 * @param params - The parameters required for the sign-up reward.
 * @returns A promise resolving to a SignUpRewardTelegram instance or a boolean value.
 *          - If the SignUpRewardTelegram instance is successfully created and initialized, it's returned.
 *          - If initialization of the reward's database fails, returns `false`.
 */
export async function createSignUpRewardTelegram(
  params: RewardParams,
): Promise<SignUpRewardTelegram | boolean> {
  const reward = new SignUpRewardTelegram(params);

  if (!(await reward.initializeRewardDatabase())) return false;

  return reward;
}

/**
 * Represents a sign-up reward specific to Telegram.
 */
export class SignUpRewardTelegram {
  /** The parameters required for the reward. */
  params: RewardParams;

  /** Indicates if the reward is present in the database. */
  isInDatabase: boolean = false;

  /** Transaction details of the reward. */
  tx: WithId<Document> | null;

  /** Current status of the reward. */
  status: TransactionStatus;

  /** Transaction hash associated with the reward. */
  txHash?: string;

  /** User operation hash. */
  userOpHash?: string;

  /** Database reference. */
  db: Db | null;

  /**
   * Creates an instance of SignUpRewardTelegram.
   * @param params - The parameters required for the reward.
   */
  constructor(params: RewardParams) {
    // Properties related to user and reward details
    this.params = params;

    // Reward-specific details
    this.params.reason = 'user_sign_up'; // Default reason for the sign-up reward
    this.params.amount = '100'; // Default amount for the sign-up reward
    this.params.message = 'Sign up reward'; // Default message for the sign-up reward

    // Properties to be initialized
    this.isInDatabase = false;
    this.tx = null;
    this.status = TRANSACTION_STATUS.UNDEFINED;
    this.txHash = undefined;
    this.userOpHash = undefined;
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
  async getRewardFromDatabase(): Promise<WithId<Document> | null> {
    if (this.db)
      return await this.db.collection(REWARDS_COLLECTION).findOne({
        userTelegramID: this.params.userTelegramID,
        eventId: this.params.eventId,
        reason: this.params.reason,
      });
    return null;
  }

  /**
   * Retrieves other reward information from the database for the same user but different event.
   * @returns {Promise<object|null>} - The reward information or null if not found.
   */
  async getOtherRewardFromDatabase(): Promise<object | null> {
    if (this.db)
      return await this.db.collection(REWARDS_COLLECTION).findOne({
        userTelegramID: this.params.userTelegramID,
        eventId: { $ne: this.params.eventId },
        reason: this.params.reason,
      });
    return null;
  }

  /**
   * Updates the reward information in the database.
   * @param {TransactionStatus} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(status: TransactionStatus, date: Date | null) {
    await this.db?.collection(REWARDS_COLLECTION).updateOne(
      {
        eventId: this.params.eventId,
        reason: this.params.reason,
        userTelegramID: this.params.userTelegramID,
      },
      {
        $set: {
          eventId: this.params.eventId,
          userTelegramID: this.params.userTelegramID,
          responsePath: this.params.responsePath,
          userHandle: this.params.userHandle,
          userName: this.params.userName,
          reason: this.params.reason,
          walletAddress: this.params.patchwallet,
          amount: this.params.amount,
          message: this.params.message,
          ...(date ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
          status: status,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] sign up reward for ${this.params.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO(): Promise<void> {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK, {
      userTelegramID: this.params.userTelegramID,
      responsePath: this.params.responsePath,
      walletAddress: this.params.patchwallet,
      reason: this.params.reason,
      userHandle: this.params.userHandle,
      userName: this.params.userName,
      amount: this.params.amount,
      message: this.params.message,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      apiKey: FLOWXO_WEBHOOK_API_KEY,
    });
  }

  /**
   * Sends a transaction action, triggering PatchWallet.
   * @returns Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> - Promise resolving to an AxiosResponse object with PatchRawResult data or AxiosError on failure.
   */
  async sendTransactionAction(): Promise<
    axios.AxiosResponse<PatchRawResult, AxiosError>
  > {
    return await sendTokens(
      SOURCE_TG_ID,
      this.params.patchwallet || '',
      this.params.amount || '',
      await getPatchWalletAccessToken(),
      this.params.delegatecall || 0,
      this.params.tokenAddress,
      this.params.chainId,
    );
  }
}

/**
 * Creates a referral reward specific to Telegram based on the specified parameters.
 * @param params - The parameters required for the reward.
 * @returns A promise resolving to a ReferralRewardTelegram instance.
 */
export async function createReferralRewardTelegram(
  params: RewardParams,
): Promise<ReferralRewardTelegram> {
  // Create a new instance of ReferralRewardTelegram
  const reward = new ReferralRewardTelegram(params);

  // Initialize the reward database by connecting and retrieving necessary information
  await reward.initializeRewardDatabase();

  return reward;
}

/**
 * Represents a referral reward specific to Telegram.
 */
export class ReferralRewardTelegram {
  /** The parameters required for the reward. */
  params: RewardParams;

  /** Transaction details of the parent. */
  parentTx?: WithId<Document>;

  /** Transaction details of the referent. */
  referent: WithId<Document> | null;

  /** Transaction details of the reward. */
  tx: WithId<Document> | null;

  /** Current status of the reward. */
  status: TransactionStatus;

  /** Transaction hash associated with the reward. */
  txHash?: string;

  /** User operation hash. */
  userOpHash?: string;

  /** Database reference. */
  db: Db | null;

  /** Cursor for transfers related to the reward. */
  transfers: FindCursor<WithId<Document>> | null;

  /**
   * Creates an instance of ReferralRewardTelegram.
   * @param params - The parameters required for the reward.
   */
  constructor(params: RewardParams) {
    // Properties related to user and reward details
    this.params = params;

    // Reward-specific details
    this.params.reason = '2x_reward'; // Default reason for the referral reward
    this.params.amount = '50'; // Default amount for the referral reward
    this.params.message = 'Referral reward'; // Default message for the referral reward

    // Properties to be initialized
    this.parentTx = undefined;
    this.referent = null;
    this.tx = null;
    this.status = TRANSACTION_STATUS.UNDEFINED;
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
  async getTransfersFromDatabase(): Promise<FindCursor<
    WithId<Document>
  > | null> {
    if (this.db)
      return this.db.collection(TRANSFERS_COLLECTION).find({
        senderTgId: { $ne: this.params.userTelegramID },
        recipientTgId: this.params.userTelegramID,
      });
    return null;
  }

  /**
   * Sets the parent transaction based on certain conditions from the retrieved transfers.
   * @returns {Promise<boolean>} - True if the parent transaction is set successfully, false otherwise.
   */
  async setParentTx(): Promise<boolean> {
    if (this.transfers) {
      for await (const transfer of this.transfers) {
        if (!this.parentTx || transfer.dateAdded < this.parentTx.dateAdded) {
          this.parentTx = transfer;
        }
      }
    }

    if (!this.parentTx) {
      console.log(
        `[${this.params.eventId}] no referral reward to distribute with ${this.params.userTelegramID} as a new user.`,
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
      if (this.db)
        this.referent = await this.db.collection(USERS_COLLECTION).findOne({
          userTelegramID: this.parentTx?.senderTgId,
        });
      if (!this.referent) {
        console.log(
          `[${this.params.eventId}] sender ${this.parentTx?.senderTgId} who is supposed to receive a referral reward is not a user.`,
        );
      }
      return Boolean(this.referent);
    } catch (error) {
      console.error(
        `[${this.params.eventId}] Error trying to get referent information: ${error}`,
      );
      return false;
    }
  }

  /**
   * Retrieves the referral reward from the database based on the event ID and reason.
   * @returns {Promise<boolean>} - True if the referral reward is retrieved successfully, false otherwise.
   */
  async getRewardSameFromDatabase(): Promise<boolean> {
    if (this.db)
      this.tx = await this.db.collection(REWARDS_COLLECTION).findOne({
        eventId: this.params.eventId,
        reason: this.params.reason,
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
      await this.db?.collection(REWARDS_COLLECTION).findOne({
        eventId: { $ne: this.params.eventId },
        reason: this.params.reason,
        userTelegramID: this.referent?.userTelegramID,
        newUserAddress: this.params.patchwallet,
      }),
    );
  }

  /**
   * Updates the PatchWallet address of the referent user for the referral reward.
   */
  async updateReferentWallet() {
    if (this.referent)
      this.referent.patchwallet =
        this.referent?.patchwallet ??
        (await getPatchWalletAddressFromTgId(this.referent?.userTelegramID));
  }

  /**
   * Updates the referral reward information in the database.
   * @param {TransactionStatus} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(status: TransactionStatus, date: Date | null) {
    await this.db?.collection(REWARDS_COLLECTION).updateOne(
      {
        eventId: this.params.eventId,
        reason: this.params.reason,
      },
      {
        $set: {
          eventId: this.params.eventId,
          userTelegramID: this.referent?.userTelegramID,
          responsePath: this.referent?.responsePath,
          userHandle: this.referent?.userHandle,
          userName: this.referent?.userName,
          reason: this.params.reason,
          walletAddress: this.referent?.patchwallet,
          amount: this.params.amount,
          message: this.params.message,
          ...(date ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
          status: status,
          newUserAddress: this.params.patchwallet,
          parentTransactionHash: this.parentTx?.transactionHash,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] referral reward for ${this.referent?.patchwallet} sending tokens to ${this.params.patchwallet} in ${this.parentTx?.transactionHash} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves referral reward transaction information to FlowXO.
   */
  async saveToFlowXO() {
    await axios.post(FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK, {
      newUserTgId: this.params.userTelegramID,
      newUserResponsePath: this.params.responsePath,
      newUserUserHandle: this.params.userHandle,
      newUserUserName: this.params.userName,
      newUserPatchwallet: this.params.patchwallet,
      userTelegramID: this.referent?.userTelegramID,
      responsePath: this.referent?.responsePath,
      walletAddress: this.referent?.patchwallet,
      reason: this.params.reason,
      userHandle: this.referent?.userHandle,
      userName: this.referent?.userName,
      amount: this.params.amount,
      message: this.params.message,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      parentTransactionHash: this.parentTx?.transactionHash,
      apiKey: FLOWXO_WEBHOOK_API_KEY,
    });
  }

  /**
   * Sends a transaction action, triggering PatchWallet.
   * @returns Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> - Promise resolving to an AxiosResponse object with PatchRawResult data or AxiosError on failure.
   */
  async sendTransactionAction(): Promise<
    axios.AxiosResponse<PatchRawResult, AxiosError>
  > {
    return await sendTokens(
      SOURCE_TG_ID,
      this.referent?.patchwallet,
      this.params.amount || '',
      await getPatchWalletAccessToken(),
      this.params.delegatecall || 0,
      this.params.tokenAddress,
      this.params.chainId,
    );
  }
}

/**
 * Creates a link reward specific to Telegram based on the specified parameters.
 * @param params - The parameters required for the link reward.
 * @returns A promise resolving to a LinkRewardTelegram instance or a boolean value.
 *          - If the LinkRewardTelegram instance is successfully created and initialized, it's returned.
 *          - If initialization of the reward's database fails, returns `false`.
 */
export async function createLinkRewardTelegram(
  params: RewardParams,
): Promise<LinkRewardTelegram | boolean> {
  const reward = new LinkRewardTelegram(params);

  if (!(await reward.initializeRewardDatabase())) return false;

  return reward;
}

/**
 * Represents a link reward for Telegram users.
 */
export class LinkRewardTelegram {
  /** The parameters required for the reward. */
  params: RewardParams;

  /** Indicates if the reward is present in the database. */
  isInDatabase: boolean = false;

  /** Transaction details of the reward. */
  tx: WithId<Document> | null;

  /** Current status of the reward. */
  status: TransactionStatus;

  /** Transaction hash associated with the reward. */
  txHash?: string;

  /** User operation hash. */
  userOpHash?: string;

  /** Transaction details of the referent. */
  referent: WithId<Document> | null;

  /** Database reference. */
  db: Db | null;

  /**
   * Constructor for LinkRewardTelegram class.
   * @param params - The parameters required for the reward.
   */
  constructor(params: RewardParams) {
    // Properties related to user and reward details
    this.params = params;

    // Reward-specific details
    this.params.reason = 'referral_link'; // Default reason for the link reward
    this.params.amount = '10'; // Default amount for the link reward
    this.params.message = 'Referral link'; // Default message for the link reward

    // Properties to be initialized
    this.tx = null;
    this.status = TRANSACTION_STATUS.UNDEFINED;
    this.txHash = undefined;
    this.userOpHash = undefined;
    this.referent = null;
  }

  /**
   * Initializes the reward database by connecting to the database and retrieving necessary information.
   * @returns {Promise<boolean>} - True if initialization is successful, false otherwise.
   */
  async initializeRewardDatabase(): Promise<boolean> {
    this.db = await Database.getInstance();

    if (!(await this.getReferent())) {
      console.log(
        `[${this.params.eventId}] ${this.params.referentUserTelegramID} referent user is not a user to process the link reward.`,
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
    if (this.db)
      this.referent = await this.db
        ?.collection(USERS_COLLECTION)
        .findOne({ userTelegramID: this.params.referentUserTelegramID });

    if (this.referent) {
      this.referent.patchwallet =
        this.referent?.patchwallet ??
        (await getPatchWalletAddressFromTgId(
          this.params.referentUserTelegramID || '',
        ));
    }
    return this.referent;
  }

  /**
   * Retrieves the reward information from the database.
   * @returns {Promise<WithId<Document>>} - The reward information or null if not found.
   */
  async getRewardFromDatabase(): Promise<WithId<Document> | null> {
    if (this.db)
      return await this.db.collection(REWARDS_COLLECTION).findOne({
        eventId: this.params.eventId,
        userTelegramID: this.params.referentUserTelegramID,
        sponsoredUserTelegramID: this.params.userTelegramID,
        reason: this.params.reason,
      });
    return null;
  }

  /**
   * Retrieves other reward information from the database for a different event.
   * @returns {Promise<object|null>} - The reward information or null if not found.
   */
  async getOtherRewardFromDatabase(): Promise<object | null> {
    if (this.db)
      return await this.db.collection(REWARDS_COLLECTION).findOne({
        sponsoredUserTelegramID: this.params.userTelegramID,
        reason: this.params.reason,
        eventId: { $ne: this.params.eventId },
      });
    return null;
  }

  /**
   * Updates the reward information in the database.
   * @param {TransactionStatus} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(status: TransactionStatus, date: Date | null) {
    await this.db?.collection(REWARDS_COLLECTION).updateOne(
      {
        eventId: this.params.eventId,
        reason: this.params.reason,
        userTelegramID: this.params.referentUserTelegramID,
      },
      {
        $set: {
          eventId: this.params.eventId,
          userTelegramID: this.params.referentUserTelegramID,
          responsePath: this.referent?.responsePath,
          userHandle: this.referent?.userHandle,
          userName: this.referent?.userName,
          reason: this.params.reason,
          walletAddress: this.referent?.patchwallet,
          amount: this.params.amount,
          message: this.params.message,
          ...(date ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
          status: status,
          sponsoredUserTelegramID: this.params.userTelegramID,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] link for ${this.params.referentUserTelegramID} sponsoring ${this.params.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to FlowXO.
   */
  async saveToFlowXO() {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_LINK_REWARD_WEBHOOK, {
      userTelegramID: this.params.referentUserTelegramID,
      responsePath: this.referent?.responsePath,
      walletAddress: this.referent?.patchwallet,
      reason: this.params.reason,
      userHandle: this.referent?.userHandle,
      userName: this.referent?.userName,
      amount: this.params.amount,
      message: this.params.message,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      sponsoredUserTelegramID: this.params.userTelegramID,
      apiKey: FLOWXO_WEBHOOK_API_KEY,
    });
  }

  /**
   * Sends a transaction action, triggering PatchWallet.
   * @returns Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> - Promise resolving to an AxiosResponse object with PatchRawResult data or AxiosError on failure.
   */
  async sendTransactionAction(): Promise<
    axios.AxiosResponse<PatchRawResult, AxiosError>
  > {
    return await sendTokens(
      SOURCE_TG_ID,
      this.referent?.patchwallet,
      this.params.amount || '',
      await getPatchWalletAccessToken(),
      this.params.delegatecall || 0,
      this.params.tokenAddress,
      this.params.chainId,
    );
  }
}

/**
 * Creates an isolated reward for Telegram based on the specified parameters.
 * @param params - The parameters required for the reward.
 * @returns A promise resolving to an IsolatedRewardTelegram instance or a boolean value.
 *          - If the IsolatedRewardTelegram instance is successfully created and initialized, it's returned.
 *          - If initialization of the reward's database fails, returns `false`.
 */
export async function createIsolatedRewardTelegram(
  params: RewardParams,
): Promise<IsolatedRewardTelegram | boolean> {
  const reward = new IsolatedRewardTelegram(params);

  if (!(await reward.initializeRewardDatabase())) return false;

  return reward;
}

/**
 * Represents an Isolated Reward specific to Telegram.
 */
export class IsolatedRewardTelegram {
  /** The parameters required for the reward. */
  params: RewardParams;

  /** Indicates if the reward is present in the database. */
  isInDatabase: boolean = false;

  /** Transaction details. */
  tx: WithId<Document> | null;

  /** Current status of the reward. */
  status: TransactionStatus;

  /** Transaction hash associated with the reward. */
  txHash?: string;

  /** Database reference. */
  db: Db | null;

  /** User operation hash. */
  userOpHash?: string;

  /** Address of the token used for the reward. */
  tokenAddress: string;

  /** Id of the blockchain network. */
  chainId: string;

  /**
   * Creates an instance of IsolatedRewardTelegram.
   * @param params - The parameters required for the reward.
   */
  constructor(params: RewardParams) {
    this.params = params;

    this.isInDatabase = false;
    this.tx = null;
    this.status = TRANSACTION_STATUS.UNDEFINED;
    this.txHash = undefined;
    this.userOpHash = undefined;
  }

  /**
   * Initializes the isolated reward object by connecting to the database and retrieving relevant information.
   * @returns {Promise<boolean>} - True if initialization is successful, false otherwise.
   */
  async initializeRewardDatabase(): Promise<boolean> {
    this.db = await Database.getInstance();
    this.params.patchwallet =
      this.params.patchwallet ??
      (await getPatchWalletAddressFromTgId(this.params.userTelegramID));
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
  async getRewardFromDatabase(): Promise<WithId<Document> | null> {
    if (this.db)
      return await this.db.collection(REWARDS_COLLECTION).findOne({
        userTelegramID: this.params.userTelegramID,
        eventId: this.params.eventId,
        reason: this.params.reason,
      });
    return null;
  }

  /**
   * Retrieves other reward information from the database for the same user but different event.
   * @returns {Promise<object|null>} - The reward information or null if not found.
   */
  async getOtherRewardFromDatabase(): Promise<object | null> {
    if (this.db)
      return await this.db.collection(REWARDS_COLLECTION).findOne({
        userTelegramID: this.params.userTelegramID,
        eventId: { $ne: this.params.eventId },
        reason: this.params.reason,
      });
    return null;
  }

  /**
   * Updates the reward information in the database.
   * @param {TransactionStatus} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(status: TransactionStatus, date: Date | null) {
    await this.db?.collection(REWARDS_COLLECTION).updateOne(
      {
        eventId: this.params.eventId,
        reason: this.params.reason,
        userTelegramID: this.params.userTelegramID,
      },
      {
        $set: {
          eventId: this.params.eventId,
          userTelegramID: this.params.userTelegramID,
          responsePath: this.params.responsePath,
          userHandle: this.params.userHandle,
          userName: this.params.userName,
          reason: this.params.reason,
          walletAddress: this.params.patchwallet,
          amount: this.params.amount,
          message: this.params.message,
          ...(date ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
          status: status,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] sign up reward for ${this.params.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO(): Promise<void> {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK, {
      userTelegramID: this.params.userTelegramID,
      responsePath: this.params.responsePath,
      walletAddress: this.params.patchwallet,
      reason: this.params.reason,
      userHandle: this.params.userHandle,
      userName: this.params.userName,
      amount: this.params.amount,
      message: this.params.message,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      apiKey: FLOWXO_WEBHOOK_API_KEY,
    });
  }

  /**
   * Sends a transaction action, triggering PatchWallet.
   * @returns Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> - Promise resolving to an AxiosResponse object with PatchRawResult data or AxiosError on failure.
   */
  async sendTransactionAction(): Promise<
    axios.AxiosResponse<PatchRawResult, AxiosError>
  > {
    return await sendTokens(
      SOURCE_TG_ID,
      this.params.patchwallet || '',
      this.params.amount || '',
      await getPatchWalletAccessToken(),
      this.params.delegatecall || 0,
      this.tokenAddress,
      this.chainId,
    );
  }
}
