import { Database } from '../db/conn';
import { TRANSACTION_STATUS, VESTING_COLLECTION } from './constants';
import {
  getPatchWalletAccessToken,
  getTxStatus,
  hedgeyLockTokens,
} from './patchwallet';
import { addVestingSegment } from './segment';
import axios from 'axios';
import { FLOWXO_NEW_VESTING_WEBHOOK } from '../../secrets';
import { Db, Document, WithId } from 'mongodb';
import { VestingParams } from '../types/hedgey.types';

/**
 * Creates a vesting specific to Telegram based on the specified parameters.
 * @param params - The parameters required for the vesting.
 * @returns A promise resolving to a VestingTelegram instance or a boolean value.
 *          - If the VestingTelegram instance is successfully created and initialized, it's returned.
 *          - If initialization of the vesting's database fails, returns `false`.
 */
export async function createVestingTelegram(
  params: VestingParams,
): Promise<VestingTelegram | boolean> {
  const vesting = new VestingTelegram(params);
  return (await vesting.initializeTransferDatabase()) && vesting;
}

/**
 * Represents a Telegram vesting.
 */
export class VestingTelegram {
  /** Unique identifier for the event. */
  eventId: string;

  /** The parameters required for the transaction. */
  params: VestingParams;

  /** Indicates if the vesting is present in the database. */
  isInDatabase: boolean = false;

  /** Transaction details of the vesting. */
  tx?: WithId<Document>;

  /** Current status of the vesting. */
  status?: string;

  /** Transaction hash associated with the vesting. */
  txHash?: string;

  /** User operation hash. */
  userOpHash?: string;

  /** Database reference. */
  db?: Db;

  /**
   * Constructor for VestingTelegram class.
   * @param params - The parameters required for the vesting.
   */
  constructor(params: VestingParams) {
    // Properties related to user and transaction details
    this.eventId = params.eventId;
    this.params = params;

    // Default values if not provided
    this.isInDatabase = false;
    this.tx = undefined;
    this.status = undefined;
    this.txHash = undefined;
    this.userOpHash = undefined;
  }

  /**
   * Initializes the vesting object by connecting to the database and retrieving relevant information.
   * @returns {Promise<boolean>} - True if initialization is successful, false otherwise.
   */
  async initializeTransferDatabase(): Promise<boolean> {
    this.db = await Database.getInstance();
    this.tx = await this.getTransferFromDatabase();

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
   * Retrieves the vesting information from the database.
   * @returns {Promise<WithId<Document>>} - The vesting information or null if not found.
   */
  async getTransferFromDatabase(): Promise<WithId<Document>> {
    return await this.db
      .collection(VESTING_COLLECTION)
      .findOne({ eventId: this.eventId });
  }

  /**
   * Updates the vesting information in the database.
   * @param {string} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(status: string, date: Date | null): Promise<void> {
    await this.db.collection(VESTING_COLLECTION).updateOne(
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
          recipients: this.params.recipients,
          status: status,
          ...(date !== null ? { dateAdded: date } : {}),
          transactionHash: this.txHash,
          userOpHash: this.userOpHash,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.eventId}] vesting from ${this.params.senderInformation.userTelegramID} in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to the Segment.
   * @returns {Promise<void>} - The result of adding the transaction to the Segment.
   */
  async saveToSegment(): Promise<void> {
    // Add transaction information to the Segment
    await addVestingSegment({
      userTelegramID: this.params.senderInformation.userTelegramID,
      senderTgId: this.params.senderInformation.userTelegramID,
      senderWallet: this.params.senderInformation.patchwallet,
      senderName: this.params.senderInformation.userName,
      senderHandle: this.params.senderInformation.userHandle,
      recipients: this.params.recipients,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      eventId: this.eventId,
      tokenSymbol: this.params.tokenSymbol,
      tokenAddress: this.params.tokenAddress,
      chainId: this.params.chainId,
    });
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO(): Promise<void> {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_VESTING_WEBHOOK, {
      senderResponsePath: this.params.senderInformation.responsePath,
      chainId: this.params.chainId,
      tokenSymbol: this.params.tokenSymbol,
      tokenAddress: this.params.tokenAddress,
      senderTgId: this.params.senderInformation.userTelegramID,
      senderWallet: this.params.senderInformation.patchwallet,
      senderName: this.params.senderInformation.userName,
      senderHandle: this.params.senderInformation.userHandle,
      recipients: this.params.recipients,
      transactionHash: this.txHash,
      dateAdded: new Date(),
    });
  }

  /**
   * Retrieves the status of the PatchWallet transaction.
   * @returns {Promise<any>} - True if the transaction status is retrieved successfully, false otherwise.
   */
  async getStatus(): Promise<any> {
    try {
      // Retrieve the status of the PatchWallet transaction
      return await getTxStatus(this.userOpHash);
    } catch (error) {
      // Log error if retrieving transaction status fails
      console.error(
        `[${this.eventId}] Error processing PatchWallet transaction status: ${error}`,
      );
      // Return true if the error status is 470, marking the transaction as failed
      return (
        (error?.response?.status === 470 &&
          (await this.updateInDatabase(TRANSACTION_STATUS.FAILURE, new Date()),
          true)) ||
        false
      );
    }
  }

  /**
   * Sends tokens using PatchWallet.
   * @returns {Promise<any>} - True if the tokens are sent successfully, false otherwise.
   */
  async sendTx(): Promise<any> {
    try {
      // Send tokens using PatchWallet
      return await hedgeyLockTokens(
        this.params.senderInformation.userTelegramID,
        this.params.recipients,
        await getPatchWalletAccessToken(),
      );
    } catch (error) {
      console.error(error);
      // Log error if sending tokens fails
      console.error(
        `[${this.eventId}] vesting from ${this.params.senderInformation.userTelegramID} - Error processing PatchWallet token sending: ${error}`,
      );
      // Return true if the amount is not a valid number or the error status is 470, marking the transaction as failed
      return error?.response?.status === 470
        ? (await this.updateInDatabase(TRANSACTION_STATUS.FAILURE, new Date()),
          true)
        : false;
    }
  }
}
