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
  getTxStatus,
  sendTokens,
} from './patchwallet';
import { addTrackSegment } from './segment';
import axios from 'axios';
import {
  FLOWXO_NEW_TRANSACTION_WEBHOOK,
  FLOWXO_WEBHOOK_API_KEY,
} from '../../secrets';
import { Db, Document, ObjectId, WithId } from 'mongodb';
import { formatDate } from './time';
import {
  PatchResult,
  TransactionParams,
  TransactionStatus,
} from '../types/webhook.types';
import { isPositiveFloat } from '../webhooks/utils';
import {
  IncomingTransaction,
  OutgoingTransaction,
} from '../types/tx_formatting.types';

/**
 * Retrieves incoming transactions for a user from the database.
 * @param db The MongoDB database instance.
 * @param userId The user's Telegram ID.
 * @param start The starting index for pagination.
 * @param limit The limit of transactions to fetch.
 * @returns A Promise resolving to an array of transactions.
 */
export async function getIncomingTxsUser(
  db: Db,
  userId: string,
  start: number,
  limit: number,
): Promise<IncomingTransaction[]> {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .find({ recipientTgId: userId })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(
      async (entry) =>
        ({
          ...entry,
          dateAdded: formatDate(entry.dateAdded),
          senderUserHandle:
            (
              await db
                .collection(USERS_COLLECTION)
                .findOne({ userTelegramID: entry.senderTgId })
            )?.userHandle || null,
        } as IncomingTransaction),
    ),
  );
}

/**
 * Retrieves outgoing transactions for a user from the database.
 * @param db The MongoDB database instance.
 * @param userId The user's Telegram ID.
 * @param start The starting index for pagination.
 * @param limit The limit of transactions to fetch.
 * @returns A Promise resolving to an array of transactions.
 */
export async function getOutgoingTxsUser(
  db: Db,
  userId: string,
  start: number,
  limit: number,
): Promise<OutgoingTransaction[]> {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .find({ senderTgId: userId })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(
      async (entry) =>
        ({
          ...entry,
          dateAdded: formatDate(entry.dateAdded),
          recipientUserHandle:
            (
              await db
                .collection(USERS_COLLECTION)
                .findOne({ userTelegramID: entry.recipientTgId })
            )?.userHandle || null,
        } as OutgoingTransaction),
    ),
  );
}

/**
 * Retrieves outgoing transactions to new users from the database.
 * @param db The MongoDB database instance.
 * @param userId The user's Telegram ID.
 * @param start The starting index for pagination.
 * @param limit The limit of transactions to fetch.
 * @returns A Promise resolving to an array of transactions.
 */
export async function getOutgoingTxsToNewUsers(
  db: Db,
  userId: string,
  start: number,
  limit: number,
): Promise<OutgoingTransaction[]> {
  return await Promise.all(
    (
      await db
        .collection(TRANSFERS_COLLECTION)
        .aggregate([
          {
            $match: {
              senderTgId: userId,
              recipientTgId: { $ne: null },
            },
          },
          {
            $lookup: {
              from: 'users',
              localField: 'recipientTgId',
              foreignField: 'userTelegramID',
              as: 'user',
            },
          },
          {
            $match: {
              user: { $size: 0 },
            },
          },
          {
            $project: {
              user: 0,
            },
          },
          {
            $sort: {
              dateAdded: -1,
            },
          },
          {
            $skip: start,
          },
          ...(limit > 0
            ? [
                {
                  $limit: limit,
                },
              ]
            : []),
        ])
        .toArray()
    ).map(
      async (entry) =>
        ({
          ...entry,
          dateAdded: formatDate(entry.dateAdded),
        } as OutgoingTransaction),
    ),
  );
}

/**
 * Represents a transaction involving rewards in the system.
 */
type RewardTransaction = {
  /**
   * The date when the reward transaction was added.
   */
  dateAdded: string;

  /**
   * A descriptive message associated with the reward transaction.
   */
  message: string;

  /**
   * The unique identifier of the reward transaction.
   */
  _id: ObjectId;

  /**
   * The amount of tokens associated with the reward transaction.
   */
  amount: string;
};

/**
 * Retrieves reward transactions for a user from the database.
 * @param db The MongoDB database instance.
 * @param userId The user's Telegram ID.
 * @param start The starting index for pagination.
 * @param limit The limit of transactions to fetch.
 * @returns An array of reward transactions.
 */
export async function getRewardTxsUser(
  db: Db,
  userId: string,
  start: number,
  limit: number,
): Promise<RewardTransaction[]> {
  return (
    await db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: userId })
      .sort({ dateAdded: -1 })
      .skip(start)
      .limit(limit)
      .toArray()
  ).map(
    (entry) =>
      ({
        ...entry,
        dateAdded: formatDate(entry.dateAdded),
      } as RewardTransaction),
  );
}

/**
 * Retrieves referral link reward transactions for a user from the database.
 * @param db The MongoDB database instance.
 * @param userId The user's Telegram ID.
 * @param start The starting index for pagination.
 * @param limit The limit of transactions to fetch.
 * @returns A Promise resolving to an array of transactions.
 */
export async function getRewardLinkTxsUser(
  db: Db,
  userId: string,
  start: number,
  limit: number,
) {
  return await Promise.all(
    (
      await db
        .collection(REWARDS_COLLECTION)
        .find({ userTelegramID: userId, reason: 'referral_link' })
        .sort({ dateAdded: -1 })
        .skip(start)
        .limit(limit)
        .toArray()
    ).map(async (entry) => ({
      ...entry,
      dateAdded: formatDate(entry.dateAdded),
      sponsoredUserHandle:
        (
          await db
            .collection(USERS_COLLECTION)
            .findOne({ userTelegramID: entry.sponsoredUserTelegramID })
        )?.userHandle || null,
    })),
  );
}

/**
 * Creates a transfer specific to Telegram based on the specified parameters.
 * @param params - The parameters required for the transfer.
 * @returns A promise resolving to a TransferTelegram instance or a boolean value.
 *          - If the TransferTelegram instance is successfully created and initialized, it's returned.
 *          - If initialization of the transfer's database fails, returns `false`.
 */
export async function createTransferTelegram(
  params: TransactionParams,
): Promise<TransferTelegram | boolean> {
  const transfer = new TransferTelegram(params);
  return (await transfer.initializeTransferDatabase()) && transfer;
}

/**
 * Represents a Telegram transfer.
 */
export class TransferTelegram {
  /** Unique identifier for the event. */
  eventId: string;

  /** The parameters required for the transaction. */
  params: TransactionParams;

  /** Indicates if the transfer is present in the database. */
  isInDatabase: boolean = false;

  /** Transaction details of the transfer. */
  tx?: WithId<Document>;

  /** Current status of the transfer. */
  status?: TransactionStatus;

  /** Wallet address of the recipient. */
  recipientWallet?: string;

  /** Transaction hash associated with the transfer. */
  txHash?: string;

  /** User operation hash. */
  userOpHash?: string;

  /** Database reference. */
  db?: Db;

  /**
   * Constructor for TransferTelegram class.
   * @param params - The parameters required for the transfer.
   */
  constructor(params: TransactionParams) {
    // Properties related to user and transaction details
    this.eventId = params.eventId;
    this.params = params;

    // Default values if not provided
    this.isInDatabase = false;
    this.tx = undefined;
    this.status = undefined;
    this.recipientWallet = undefined;
    this.txHash = undefined;
    this.userOpHash = undefined;
  }

  /**
   * Initializes the transfer object by connecting to the database and retrieving relevant information.
   * @returns {Promise<boolean>} - True if initialization is successful, false otherwise.
   */
  async initializeTransferDatabase(): Promise<boolean> {
    this.db = await Database.getInstance();
    this.tx = await this.getTransferFromDatabase();

    try {
      this.recipientWallet = await getPatchWalletAddressFromTgId(
        this.params.recipientTgId,
      );
    } catch (error) {
      return false;
    }

    if (this.tx) {
      this.isInDatabase = true;
      this.status = this.tx.status;
      this.userOpHash = this.tx.userOpHash;
    } else {
      await this.updateInDatabase(TRANSACTION_STATUS.PENDING, new Date());
    }

    return true;
  }

  /**
   * Retrieves the transfer information from the database.
   * @returns {Promise<WithId<Document>>} - The transfer information or null if not found.
   */
  async getTransferFromDatabase(): Promise<WithId<Document>> {
    return await this.db
      .collection(TRANSFERS_COLLECTION)
      .findOne({ eventId: this.eventId });
  }

  /**
   * Updates the transfer information in the database.
   * @param {TransactionStatus} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(
    status: TransactionStatus,
    date: Date | null,
  ): Promise<void> {
    await this.db.collection(TRANSFERS_COLLECTION).updateOne(
      { eventId: this.eventId },
      {
        $set: {
          eventId: this.eventId,
          chainId: this.params.chainId,
          tokenSymbol: this.params.tokenSymbol,
          tokenAddress: this.params.tokenAddress,
          senderTgId: this.params.senderInformation.userTelegramID,
          senderWallet: this.params.senderInformation.patchwallet,
          senderName: this.params.senderInformation.userName,
          senderHandle: this.params.senderInformation.userHandle,
          recipientTgId: this.params.recipientTgId,
          recipientWallet: this.recipientWallet,
          tokenAmount: this.params.amount,
          status: status,
          ...(date !== null ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.eventId}] transaction from ${this.params.senderInformation.userTelegramID} to ${this.params.recipientTgId} for ${this.params.amount} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to the Segment.
   * @returns {Promise<void>} - The result of adding the transaction to the Segment.
   */
  async saveToSegment(): Promise<void> {
    // Add transaction information to the Segment
    await addTrackSegment({
      ...this.params,
      dateAdded: new Date(),
      transactionHash: this.txHash,
      recipientWallet: this.recipientWallet,
    });
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO(): Promise<void> {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_TRANSACTION_WEBHOOK, {
      senderResponsePath: this.params.senderInformation.responsePath,
      chainId: this.params.chainId,
      tokenSymbol: this.params.tokenSymbol,
      tokenAddress: this.params.tokenAddress,
      senderTgId: this.params.senderInformation.userTelegramID,
      senderWallet: this.params.senderInformation.patchwallet,
      senderName: this.params.senderInformation.userName,
      senderHandle: this.params.senderInformation.userHandle,
      recipientTgId: this.params.recipientTgId,
      recipientWallet: this.recipientWallet,
      tokenAmount: this.params.amount,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      apiKey: FLOWXO_WEBHOOK_API_KEY,
    });
  }

  /**
   * Retrieves the status of the PatchWallet transaction.
   * @returns {Promise<PatchResult>} - True if the transaction status is retrieved successfully, false otherwise.
   */
  async getStatus(): Promise<PatchResult> {
    try {
      // Retrieve the status of the PatchWallet transaction
      const res = await getTxStatus(this.userOpHash);

      return {
        isError: false,
        userOpHash: res.data.userOpHash,
        txHash: res.data.txHash,
      };
    } catch (error) {
      // Log error if retrieving transaction status fails
      console.error(
        `[${this.eventId}] Error processing PatchWallet transaction status: ${error}`,
      );
      // Return true if the error status is 470, marking the transaction as failed
      return (
        (error?.response?.status === 470 &&
          (await this.updateInDatabase(TRANSACTION_STATUS.FAILURE, new Date()),
          { isError: true })) || { isError: false }
      );
    }
  }

  /**
   * Sends tokens using PatchWallet.
   * @returns {Promise<PatchResult>} - True if the tokens are sent successfully, false otherwise.
   */
  async sendTx(): Promise<PatchResult> {
    try {
      // Send tokens using PatchWallet
      const res = await sendTokens(
        this.params.senderInformation.userTelegramID,
        this.recipientWallet,
        this.params.amount,
        await getPatchWalletAccessToken(),
        this.params.delegatecall,
        this.params.tokenAddress,
        this.params.chainId,
      );

      return {
        isError: false,
        userOpHash: res.data.userOpHash,
        txHash: res.data.txHash,
      };
    } catch (error) {
      // Log error if sending tokens fails
      console.error(
        `[${this.eventId}] transaction from ${this.params.senderInformation.userTelegramID} to ${this.params.recipientTgId} for ${this.params.amount} - Error processing PatchWallet token sending: ${error}`,
      );
      // Check for potential invalid amount or specific error responses
      if (
        !isPositiveFloat(this.params.amount) ||
        error?.response?.status === 470
      ) {
        console.warn(
          `Potentially invalid amount: ${this.params.amount}, dropping`,
        );
        await this.updateInDatabase(TRANSACTION_STATUS.FAILURE, new Date());
        return { isError: true };
      }
      // Handling specific error response status 503
      if (error?.response?.status === 503) {
        await this.updateInDatabase(TRANSACTION_STATUS.FAILURE_503, new Date());
        return { isError: true };
      }
      // Return PatchResult indicating no error if not handled specifically
      return { isError: false };
    }
  }
}
