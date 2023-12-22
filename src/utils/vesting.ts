import { Database } from '../db/conn';
import {
  DEFAULT_CHAIN_ID,
  GRINDERY_VESTING_ADMIN,
  HEDGEY_LOCKUP_LOCKER,
  HEDGEY_VESTING_LOCKER,
  IDO_START_DATE,
  TOKEN_LOCK_TERM,
  TRANSACTION_STATUS,
  VESTING_COLLECTION,
} from './constants';
import {
  getPatchWalletAccessToken,
  getTxStatus,
  hedgeyLockTokens,
} from './patchwallet';
import { addVestingSegment } from './segment';
import axios, { AxiosError } from 'axios';
import {
  FLOWXO_NEW_VESTING_WEBHOOK,
  FLOWXO_WEBHOOK_API_KEY,
  G1_POLYGON_ADDRESS,
} from '../../secrets';
import { Db, Document, WithId } from 'mongodb';
import {
  HedgeyPlanParams,
  HedgeyRecipientParams,
  VestingParams,
} from '../types/hedgey.types';
import {
  getContract,
  getHedgeyBatchPlannerContract,
  scaleDecimals,
} from './web3';
import BigNumber from 'bignumber.js';
import {
  PatchRawResult,
  PatchResult,
  TransactionStatus,
} from '../types/webhook.types';

/**
 * Calculates and generates plans for distributing tokens to recipients over time.
 *
 * @param recipients An array of HedgeyRecipientParams containing recipient information.
 * @param tokenAddress The token contract address. Defaults to G1_POLYGON_ADDRESS if not provided.
 * @param chainId The chain ID. Defaults to DEFAULT_CHAIN_ID if not provided.
 *
 * @returns A Promise that resolves to an object containing totalAmount and plans.
 *          - totalAmount: The total sum of token amounts for all recipients.
 *          - plans: An array of HedgeyPlanParams representing the distribution plans.
 */
export async function getPlans(
  recipients: HedgeyRecipientParams[],
  tokenAddress: string = G1_POLYGON_ADDRESS,
  chainId: string = DEFAULT_CHAIN_ID,
): Promise<{
  totalAmount: string;
  plans: HedgeyPlanParams[];
}> {
  const startDate = Math.round(IDO_START_DATE.getTime() / 1000); // Could use Date.now() instead of constant
  let totalAmount = BigNumber(0);

  const plans = await Promise.all(
    recipients.map(async (plan) => {
      const amountWei = BigNumber(
        scaleDecimals(
          plan.amount,
          await getContract(chainId, tokenAddress).methods.decimals().call(),
        ),
      );

      totalAmount = totalAmount.plus(amountWei);
      return [
        plan.recipientAddress,
        amountWei.toString(),
        startDate,
        startDate, // No cliff
        amountWei
          .div(BigNumber(TOKEN_LOCK_TERM))
          .decimalPlaces(0, BigNumber.ROUND_CEIL)
          .toString(), // Rate is tokens unlocked per second
      ] as HedgeyPlanParams;
    }),
  );

  return { totalAmount: totalAmount.toString(), plans };
}

/**
 * Generates data for batch vesting or locking plans based on the useVesting flag.
 *
 * @param useVesting A boolean flag indicating whether to use vesting or locking.
 * @param chainId The chain ID for the contract interaction.
 * @param tokenAddress The token contract address.
 * @param totalAmount The total amount of tokens to distribute.
 * @param plans An array of HedgeyPlanParams representing the distribution plans.
 *
 * @returns A Promise that resolves to an array of strings containing ABI-encoded data for contract interaction.
 */

export async function getData(
  useVesting: boolean,
  chainId: string,
  tokenAddress: string,
  totalAmount: string,
  plans: HedgeyPlanParams[],
): Promise<string> {
  return useVesting
    ? getHedgeyBatchPlannerContract(chainId)
        .methods['batchVestingPlans'](
          HEDGEY_VESTING_LOCKER,
          tokenAddress,
          totalAmount,
          plans,
          1, // Period: Linear
          GRINDERY_VESTING_ADMIN,
          true,
          4, // Vesting (fixed Hedgey constant)
        )
        .encodeABI()
    : getHedgeyBatchPlannerContract(chainId)
        .methods['batchLockingPlans'](
          HEDGEY_LOCKUP_LOCKER,
          tokenAddress,
          totalAmount,
          plans,
          1, // Period: Linear
          5, // Investor Lockups (fixed Hedgey constant)
        )
        .encodeABI();
}

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
  status?: TransactionStatus;

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
   * @param {TransactionStatus} status - The transaction status.
   * @param {Date|null} date - The date of the transaction.
   */
  async updateInDatabase(
    status: TransactionStatus,
    date: Date | null,
  ): Promise<void> {
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
      ...this.params,
      transactionHash: this.txHash,
      dateAdded: new Date(),
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
   * Sends a transaction action, triggering PatchWallet.
   * @returns Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> - Promise resolving to an AxiosResponse object with PatchRawResult data or AxiosError on failure.
   */
  async sendTransactionAction(): Promise<
    axios.AxiosResponse<PatchRawResult, AxiosError>
  > {
    return await hedgeyLockTokens(
      this.params.senderInformation.userTelegramID,
      this.params.recipients,
      await getPatchWalletAccessToken(),
    );
  }
}
