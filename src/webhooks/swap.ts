import {
  SWAPS_COLLECTION,
  TRANSACTION_STATUS,
  USERS_COLLECTION,
  nativeTokenAddresses,
} from '../utils/constants';
import { Database } from '../db/conn';
import {
  getStatus,
  isFailedTransaction,
  isPendingTransactionHash,
  isSuccessfulTransaction,
  isTreatmentDurationExceeded,
  sendTransaction,
  updateTxHash,
  updateUserOpHash,
} from './utils';
import {
  PatchRawResult,
  PatchResult,
  SwapParams,
  TransactionStatus,
  createSwapParams,
} from '../types/webhook.types';
import { addTrackSwapSegment } from '../utils/segment';
import { FLOWXO_NEW_SWAP_WEBHOOK, FLOWXO_WEBHOOK_API_KEY } from '../../secrets';
import axios, { AxiosError } from 'axios';
import { getContract, weiToEther } from '../utils/web3';
import { CHAIN_MAPPING } from '../utils/chains';
import { getPatchWalletAccessToken, swapTokens } from '../utils/patchwallet';
import { Db, WithId } from 'mongodb';
import { MongoSwap, MongoUser } from '../types/mongo.types';

/**
 * Handles the swap process based on provided parameters.
 * @param {SwapParams} params - Parameters required for the swap.
 * @returns {Promise<boolean>} - Promise resolving to a boolean indicating success or failure of the swap process.
 */
export async function handleSwap(params: SwapParams): Promise<boolean> {
  // Get the database instance
  const db = await Database.getInstance();

  // Fetch user information from the database based on the provided Telegram ID
  const userInformation = (await db?.collection(USERS_COLLECTION).findOne({
    userTelegramID: params.userTelegramID,
  })) as WithId<MongoUser> | null;

  // If user information is not found, log an error and return true indicating handled status
  if (!userInformation) {
    console.error(
      `[SWAP EVENT] Event ID [${params.eventId}] User Telegram ID [${params.userTelegramID}] does not exist in the database.`,
    );
    return true;
  }

  // Create a swap instance with provided parameters and user information
  const swap = await SwapTelegram.build(
    createSwapParams(params, userInformation),
  );

  // If the swap status indicates success or failure, return true indicating handled status
  if (isSuccessfulTransaction(swap.status) || isFailedTransaction(swap.status))
    return true;

  let tx: PatchResult | undefined;

  // Handle pending hash status
  if (isPendingTransactionHash(swap.status)) {
    // Check if treatment duration for the swap is exceeded, if so, return true indicating handled status
    if (await isTreatmentDurationExceeded(swap)) return true;

    // If userOpHash is not available, mark the swap as successful and return true indicating handled status
    if (!swap.userOpHash) {
      await swap.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date());
      console.log(
        `[SWAP EVENT] Event ID [${params.eventId}] Swap marked as successful as userOpHash is not available.`,
      );
      return true; // Indicating handled status
    }

    // Check status for userOpHash and return the status if it's retrieved successfully or false if failed
    tx = await getStatus(swap);
    if (tx.isError) return true;
    if (!tx.txHash && !tx.userOpHash) return false;
  }

  // Handle sending transaction if not already handled
  if (!tx) {
    tx = await sendTransaction(swap);
    if (tx.isError) return true;
    if (!tx.txHash && !tx.userOpHash) return false;
  }

  // Finalize transaction handling if tx data's txHash exists
  if (tx && tx.txHash) {
    // Update transaction hash, update database, save to Segment and FlowXO
    updateTxHash(swap, tx.txHash);
    await Promise.all([
      swap.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
      swap.saveToSegment(),
      swap.saveToFlowXO(),
    ]).catch((error) =>
      console.error(
        `[SWAP EVENT] Event ID [${params.eventId}] Error processing Segment or FlowXO webhook: ${error}`,
      ),
    );

    // Log successful swap event completion
    console.log(
      `[SWAP EVENT] Event ID [${swap.txHash}] Swap event [${tx.txHash}] from ${params.userTelegramID} completed successfully.`,
    );
    return true;
  }

  // Handle pending hash for userOpHash, if available
  tx &&
    tx.userOpHash &&
    updateUserOpHash(swap, tx.userOpHash) &&
    (await swap.updateInDatabase(TRANSACTION_STATUS.PENDING_HASH, null));

  // Return false indicating swap process is not fully handled
  return false;
}

/**
 * Represents a Telegram swap.
 */
export class SwapTelegram {
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
  tx: WithId<MongoSwap> | null;
  /**
   * The status of the swap.
   */
  status: TransactionStatus;
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
  db: Db | null;

  /**
   * Initializes a SwapTelegram instance with parameters.
   * @param {SwapParams} params - Parameters for the swap.
   */
  constructor(params: SwapParams) {
    // Assigns the incoming 'params' to the class property 'params'
    this.params = params;

    // Initializes the 'isInDatabase' property to 'false' by default
    this.isInDatabase = false;

    // Initializes the 'status' property to 'TRANSACTION_STATUS.UNDEFINED' by default
    this.status = TRANSACTION_STATUS.UNDEFINED;
  }

  /**
   * Asynchronously initializes the swap in the database and builds a SwapTelegram instance.
   * @param {SwapParams} params - Parameters for the swap.
   * @returns {Promise<SwapTelegram>} - Promise resolving to a SwapTelegram instance.
   */
  static async build(params: SwapParams): Promise<SwapTelegram> {
    // Create a new SwapTelegram instance with provided params
    const swap = new SwapTelegram(params);

    // Obtain the database instance and assign it to the swap object
    swap.db = await Database.getInstance();

    // Retrieve the swap details from the database and assign them to the swap object
    swap.tx = await swap.getSwapFromDatabase();

    // Check if the swap exists in the database
    if (swap.tx) {
      // If the swap exists, update relevant swap properties
      swap.isInDatabase = true;
      ({ status: swap.status, userOpHash: swap.userOpHash } = swap.tx);
    } else {
      // If the swap doesn't exist, add it to the database with PENDING status and current date
      await swap.updateInDatabase(TRANSACTION_STATUS.PENDING, new Date());
    }

    // Return the fully initialized SwapTelegram instance
    return swap;
  }

  /**
   * Retrieves swap information from the database.
   * @returns {Promise<WithId<MongoSwap>>} - Promise resolving to swap information or null if not found.
   */
  async getSwapFromDatabase(): Promise<WithId<MongoSwap> | null> {
    if (this.db)
      return (await this.db
        .collection(SWAPS_COLLECTION)
        .findOne({ eventId: this.params.eventId })) as WithId<MongoSwap> | null;
    return null;
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
    await this.db?.collection(SWAPS_COLLECTION).updateOne(
      { eventId: this.params.eventId },
      {
        $set: {
          eventId: this.params.eventId,
          userTelegramID: this.params.userInformation?.userTelegramID,
          userWallet: this.params.userInformation?.patchwallet,
          userName: this.params.userInformation?.userName,
          userHandle: this.params.userInformation?.userHandle,
          tokenIn: this.params.tokenIn,
          amountIn: this.params.amountIn,
          tokenOut: this.params.tokenOut,
          amountOut: this.params.amountOut,
          priceImpact: this.params.priceImpact,
          gas: this.params.gas,
          status: status,
          transactionHash: this.txHash,
          ...(date ? { dateAdded: date } : {}),
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
      transactionHash: this.txHash || '',
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
      userResponsePath: this.params.userInformation?.responsePath,
      eventId: this.params.eventId,
      userTelegramID: this.params.userTelegramID,
      userWallet: this.params.userInformation?.patchwallet,
      userName: this.params.userInformation?.userName,
      userHandle: this.params.userInformation?.userHandle,
      tokenIn: this.params.tokenIn,
      amountIn: weiToEther(
        this.params.amountIn,
        nativeTokenAddresses.includes(this.params.tokenIn)
          ? 18
          : await getContract(this.params.chainIn, this.params.tokenIn)
              .methods.decimals()
              .call(),
      ),
      tokenOut: this.params.tokenOut,
      amountOut: weiToEther(
        this.params.amountOut,
        nativeTokenAddresses.includes(this.params.tokenOut)
          ? 18
          : await getContract(this.params.chainOut, this.params.tokenOut)
              .methods.decimals()
              .call(),
      ),
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
      chainInName: CHAIN_MAPPING[this.params.chainIn || ''].name_display,
      chainOutName: CHAIN_MAPPING[this.params.chainOut || ''].name_display,
      transactionLink:
        CHAIN_MAPPING[this.params.chainOut || ''].explorer + this.txHash,
    });
  }

  /**
   * Sends a transaction action, triggering PatchWallet.
   * @returns Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> - Promise resolving to an AxiosResponse object with PatchRawResult data or AxiosError on failure.
   */
  async sendTransactionAction(): Promise<
    axios.AxiosResponse<PatchRawResult, AxiosError>
  > {
    return await swapTokens(
      this.params.userInformation?.userTelegramID || '',
      this.params.to || '',
      this.params.value,
      this.params.data || '',
      this.params.chainIn || '',
      await getPatchWalletAccessToken(),
      this.params.delegatecall || 0,
    );
  }
}
