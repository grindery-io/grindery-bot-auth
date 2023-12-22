import { Database } from '../db/conn';
import {
  SWAPS_COLLECTION,
  TRANSACTION_STATUS,
  nativeTokenAddresses,
} from './constants';
import { Db, Document, WithId } from 'mongodb';
import {
  getPatchWalletAccessToken,
  getTxStatus,
  swapTokens,
} from './patchwallet';
import { FLOWXO_NEW_SWAP_WEBHOOK, FLOWXO_WEBHOOK_API_KEY } from '../../secrets';
import axios, { AxiosError } from 'axios';
import { addTrackSwapSegment } from './segment';
import {
  PatchRawResult,
  PatchResult,
  SwapParams,
  TransactionStatus,
} from '../types/webhook.types';
import { getContract } from './web3';
import { CHAIN_MAPPING } from './chains';
import BigNumber from 'bignumber.js';

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
  status?: TransactionStatus;
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
   * @param {TransactionStatus} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(
    status: TransactionStatus,
    date: Date | null,
  ): Promise<void> {
    await this.db.collection(SWAPS_COLLECTION).updateOne(
      { eventId: this.params.eventId },
      {
        $set: {
          eventId: this.params.eventId,
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
          chainIn: this.params.chainIn,
          chainOut: this.params.chainOut,
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
      ...this.params,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      status: TRANSACTION_STATUS.SUCCESS,
    });
  }

  /**
   * Saves transaction information to FlowXO.
   * @returns {Promise<void>} - The result of sending the transaction to FlowXO.
   */
  async saveToFlowXO(): Promise<void> {
    // Send transaction information to FlowXO
    await axios.post(FLOWXO_NEW_SWAP_WEBHOOK, {
      userResponsePath: this.params.userInformation.responsePath,
      eventId: this.params.eventId,
      userTelegramID: this.params.userTelegramID,
      userWallet: this.params.userInformation.patchwallet,
      userName: this.params.userInformation.userName,
      userHandle: this.params.userInformation.userHandle,
      tokenIn: this.params.tokenIn,
      amountIn: new BigNumber(parseInt(this.params.amountIn))
        .div(
          10 **
            (nativeTokenAddresses.includes(this.params.tokenIn)
              ? 18
              : await getContract(this.params.chainIn, this.params.tokenIn)
                  .methods.decimals()
                  .call()),
        )
        .toString(),
      tokenOut: this.params.tokenOut,
      amountOut: new BigNumber(parseInt(this.params.amountOut))
        .div(
          10 **
            (nativeTokenAddresses.includes(this.params.tokenOut)
              ? 18
              : await getContract(this.params.chainOut, this.params.tokenOut)
                  .methods.decimals()
                  .call()),
        )
        .toString(),
      priceImpact: this.params.priceImpact,
      gas: this.params.gas,
      status: TRANSACTION_STATUS.SUCCESS,
      transactionHash: this.txHash,
      dateAdded: new Date(),
      to: this.params.to,
      from: this.params.from,
      tokenInSymbol: this.params.tokenInSymbol,
      tokenOutSymbol: this.params.tokenOutSymbol,
      apiKey: FLOWXO_WEBHOOK_API_KEY,
      chainIn: this.params.chainIn,
      chainOut: this.params.chainOut,
      chainInName: CHAIN_MAPPING[this.params.chainIn].name_display,
      chainOutName: CHAIN_MAPPING[this.params.chainOut].name_display,
      transactionLink:
        CHAIN_MAPPING[this.params.chainOut].explorer + this.txHash,
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
   * Sends a transaction action, triggering PatchWallet.
   * @returns Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> - Promise resolving to an AxiosResponse object with PatchRawResult data or AxiosError on failure.
   */
  async sendTransactionAction(): Promise<
    axios.AxiosResponse<PatchRawResult, AxiosError>
  > {
    return await swapTokens(
      this.params.userInformation.userTelegramID,
      this.params.to,
      this.params.value,
      this.params.data,
      this.params.chainIn,
      await getPatchWalletAccessToken(),
      this.params.delegatecall,
    );
  }
}
