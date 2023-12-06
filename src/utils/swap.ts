import { Database } from '../db/conn';
import { SWAPS_COLLECTION, TRANSACTION_STATUS } from './constants';
import { Db, Document, WithId } from 'mongodb';
import {
  getPatchWalletAccessToken,
  getTxStatus,
  swapTokens,
} from './patchwallet';
import { FLOWXO_NEW_SWAP_WEBHOOK } from '../../secrets';
import axios from 'axios';
import { addTrackSwapSegment } from './segment';
import { SwapParams } from './webhooks/types';

/**
 * Asynchronously creates a swap for Telegram.
 * @param {SwapParams} params - Parameters required for the swap.
 * @returns {Promise<SwapTelegram>} - Promise resolving to a SwapTelegram instance.
 */
export async function createSwapTelegram(
  params: SwapParams,
): Promise<SwapTelegram> {
  const swap = new SwapTelegram(params);
  await swap.initializeSwapDatabase();
  return swap;
}

/**
 * Represents a Telegram swap.
 */
export class SwapTelegram {
  /**
   * The event ID associated with the swap.
   */
  eventId: string;
  /**
   * Parameters for the swap.
   */
  params: SwapParams;
  /**
   * Indicates whether the swap is in the database.
   */
  isInDatabase: boolean = false;
  /**
   * Transaction details associated with the swap.
   */
  tx?: WithId<Document>;
  /**
   * The status of the swap.
   */
  status?: string;
  /**
   * The recipient's wallet address.
   */
  recipientWallet?: string;
  /**
   * The transaction hash associated with the swap.
   */
  txHash?: string;
  /**
   * The user operation hash for the swap.
   */
  userOpHash?: string;
  /**
   * The MongoDB database instance.
   */
  db?: Db;

  /**
   * Initializes a SwapTelegram instance with parameters.
   * @param {SwapParams} params - Parameters for the swap.
   */
  constructor(params: SwapParams) {
    this.eventId = params.eventId;
    this.params = params;
    this.params.chainId = this.params.chainId
      ? this.params.chainId
      : 'eip155:137';
    this.params.chainName = this.params.chainName
      ? this.params.chainName
      : 'matic';

    this.isInDatabase = false;
    this.tx = undefined;
    this.status = undefined;
    this.recipientWallet = undefined;
    this.txHash = undefined;
    this.userOpHash = undefined;
  }

  /**
   * Initializes the swap in the database.
   * @returns {Promise<boolean>} - Promise resolving to a boolean indicating success.
   */
  async initializeSwapDatabase(): Promise<boolean> {
    this.db = await Database.getInstance();
    this.tx = await this.getSwapFromDatabase();

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
   * Retrieves swap information from the database.
   * @returns {Promise<WithId<Document>>} - Promise resolving to swap information or null if not found.
   */
  async getSwapFromDatabase(): Promise<WithId<Document>> {
    return await this.db
      .collection(SWAPS_COLLECTION)
      .findOne({ eventId: this.params.eventId });
  }

  /**
   * Updates swap information in the database.
   * @param {string} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(status: string, date: Date | null): Promise<void> {
    await this.db.collection(SWAPS_COLLECTION).updateOne(
      { eventId: this.params.eventId },
      {
        $set: {
          eventId: this.params.eventId,
          chainId: this.params.chainId,
          userTelegramID: this.params.userInformation.userTelegramID,
          userWallet: this.params.userInformation.patchwallet,
          userName: this.params.userInformation.userName,
          userHandle: this.params.userInformation.userHandle,
          tokenIn: this.params.tokenIn,
          amountIn: this.params.amountIn,
          tokenOut: this.params.tokenOut,
          amountOut: this.params.amountOut,
          priceImpact: this.params.priceImpact,
          gas: this.params.gas,
          status: status,
          transactionHash: this.txHash,
          ...(date !== null ? { dateAdded: date } : {}),
          to: this.params.to,
          from: this.params.from,
          tokenInSymbol: this.params.tokenInSymbol,
          tokenOutSymbol: this.params.tokenOutSymbol,
          userOpHash: this.userOpHash,
        },
      },
      { upsert: true },
    );
    console.log(
      `[${this.params.eventId}] swap event in MongoDB as ${status} with transaction hash : ${this.txHash}.`,
    );
  }

  /**
   * Saves transaction information to the Segment.
   * @returns {Promise<void>} - The result of adding the transaction to the Segment.
   */
  async saveToSegment(): Promise<void> {
    // Add transaction information to the Segment
    await addTrackSwapSegment({
      eventId: this.params.eventId,
      chainId: this.params.chainId,
      userTelegramID: this.params.userInformation.userTelegramID,
      userWallet: this.params.userInformation.patchwallet,
      userName: this.params.userInformation.userName,
      userHandle: this.params.userInformation.userHandle,
      tokenIn: this.params.tokenIn,
      amountIn: this.params.amountIn,
      tokenOut: this.params.tokenOut,
      amountOut: this.params.amountOut,
      priceImpact: this.params.priceImpact,
      gas: this.params.gas,
      status: TRANSACTION_STATUS.SUCCESS,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      to: this.params.to,
      from: this.params.from,
      tokenInSymbol: this.params.tokenInSymbol,
      tokenOutSymbol: this.params.tokenOutSymbol,
    });
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO(): Promise<void> {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_SWAP_WEBHOOK, {
      eventId: this.params.eventId,
      chainId: this.params.chainId,
      userTelegramID: this.params.userTelegramID,
      userWallet: this.params.userInformation.patchwallet,
      userName: this.params.userInformation.userName,
      userHandle: this.params.userInformation.userHandle,
      tokenIn: this.params.tokenIn,
      amountIn: this.params.amountIn,
      tokenOut: this.params.tokenOut,
      amountOut: this.params.amountOut,
      priceImpact: this.params.priceImpact,
      gas: this.params.gas,
      status: TRANSACTION_STATUS.SUCCESS,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      to: this.params.to,
      from: this.params.from,
      tokenInSymbol: this.params.tokenInSymbol,
      tokenOutSymbol: this.params.tokenOutSymbol,
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
  async swapTokens(): Promise<any> {
    try {
      // Send tokens using PatchWallet
      return await swapTokens(
        this.params.userInformation.userTelegramID,
        this.params.to,
        this.params.value,
        this.params.data,
        this.params.chainName,
        await getPatchWalletAccessToken(),
      );
    } catch (error) {
      // Log error if sending tokens fails
      console.error(
        `[${this.params.eventId}] Error processing PatchWallet swap for user telegram id [${this.params.userTelegramID}]: ${error.message}`,
      );
      // Return true if the amount is not a valid number or the error status is 470, marking the transaction as failed
      return !/^\d+$/.test(this.params.value) ||
        error?.response?.status === 470 ||
        error?.response?.status === 400
        ? (console.warn(
            `Potentially invalid amount: ${this.params.amount}, dropping`,
          ),
          await this.updateInDatabase(TRANSACTION_STATUS.FAILURE, new Date()),
          true)
        : false;
    }
  }
}
