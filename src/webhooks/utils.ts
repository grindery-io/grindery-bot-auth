import {
  PatchResult,
  Reward,
  TelegramOperations,
  TransactionStatus,
} from '../types/webhook.types';
import { TRANSACTION_STATUS } from '../utils/constants';
import { getTxStatus } from '../utils/patchwallet';
import { SwapTelegram } from '../utils/swap';
import { getXMinBeforeDate } from '../utils/time';
import { TransferTelegram } from '../utils/transfers';
import { VestingTelegram } from '../utils/vesting';

/**
 * Checks if the provided status indicates a successful transaction.
 * @param status - The status of the transaction.
 * @returns {boolean} - True if the transaction status represents success, otherwise false.
 */
export function isSuccessfulTransaction(status: TransactionStatus): boolean {
  return status === TRANSACTION_STATUS.SUCCESS;
}

/**
 * Checks if the transaction has failed.
 * @param status - The status of the transaction.
 * @returns {boolean} - True if the transaction has failed, false otherwise.
 */
export function isFailedTransaction(status: TransactionStatus): boolean {
  return (
    status === TRANSACTION_STATUS.FAILURE ||
    status === TRANSACTION_STATUS.FAILURE_503
  );
}

/**
 * Checks if the transaction is in the pending hash state.
 * @param status - The status of the transaction.
 * @returns {boolean} - True if the transaction is in the pending hash state, false otherwise.
 */
export function isPendingTransactionHash(status: TransactionStatus): boolean {
  return status === TRANSACTION_STATUS.PENDING_HASH;
}

/**
 * Checks if the given string is a positive float number.
 * @param inputString - The string to be checked.
 * @returns {boolean} - True if the string is a positive float number, otherwise false.
 */
export function isPositiveFloat(inputString: string): boolean {
  // Regular expression to match a positive float number
  const floatRegex = /^[+]?\d+(\.\d+)?$/;

  // Check if the input string matches the regex pattern for a positive float number
  return floatRegex.test(inputString);
}

/**
 * Checks if the treatment duration of a given instance exceeds a specified duration.
 * @param {TelegramOperations} telegram_operation - The instance to be checked.
 * @returns {Promise<boolean>} A Promise resolving to a boolean indicating if the treatment duration has exceeded.
 * @throws {Error} Throws an error if there is an issue updating the instance in the database.
 */
export async function isTreatmentDurationExceeded(
  telegram_operation: TelegramOperations,
): Promise<boolean> {
  return (
    (telegram_operation.tx?.dateAdded < getXMinBeforeDate(new Date(), 10) &&
      (console.log(
        `[${telegram_operation.eventId}] was stopped due to too long treatment duration (> 10 min).`,
      ),
      await telegram_operation.updateInDatabase(
        TRANSACTION_STATUS.FAILURE,
        new Date(),
      ),
      true)) ||
    false
  );
}

/**
 * Retrieves the status of rewards based on the provided reward instance.
 *
 * @param reward An instance representing various reward types:
 *  - `IsolatedRewardTelegram`
 *  - `LinkRewardTelegram`
 *  - `ReferralRewardTelegram`
 *  - `SignUpRewardTelegram`
 * @returns A Promise that resolves to the status of rewards retrieval.
 *   If successful, returns the status obtained from the transaction; otherwise, returns `false`.
 * @throws Error if there's an issue during the status retrieval process.
 */
export async function getStatusRewards(reward: Reward): Promise<PatchResult> {
  try {
    // Retrieve the status of the PatchWallet transaction
    const status = await getTxStatus(reward.userOpHash);
    return {
      isError: false,
      userOpHash: status.data.userOpHash,
      txHash: status.data.txHash,
    };
  } catch (error) {
    // Log error if retrieving transaction status fails
    console.error(
      `[${reward.eventId}] Error processing PatchWallet transaction status: ${error}`,
    );
    return { isError: true };
  }
}

/**
 * Updates the userOpHash property of a reward telegram instance.
 * @param telegram_operation The reward telegram instance.
 * @param userOpHash The user operation hash to update.
 * @returns The updated user operation hash.
 */
export function updateUserOpHash(
  telegram_operation: TelegramOperations,
  userOpHash: string,
): string {
  return (telegram_operation.userOpHash = userOpHash);
}

/**
 * Updates the txHash property of a reward telegram instance.
 * @param telegram_operation The reward telegram instance.
 * @param txHash The transaction hash to update.
 * @returns The updated transaction hash.
 */
export function updateTxHash(
  telegram_operation: TelegramOperations,
  txHash: string,
): string {
  return (telegram_operation.txHash = txHash);
}

/**
 * Sends a transaction based on the TelegramOperations instance provided.
 * @param telegram_operation - Instance of TelegramOperations representing the transaction to be sent.
 * @returns Promise<PatchResult> - Promise resolving to a PatchResult object indicating transaction status.
 */
export async function sendTransaction(
  telegram_operation: TelegramOperations,
): Promise<PatchResult> {
  try {
    // Attempt to perform the transaction using the provided TelegramOperations instance.
    const { data } = await telegram_operation.sendTransactionAction();

    // If successful, return the transaction result with userOpHash and txHash.
    return { isError: false, userOpHash: data.userOpHash, txHash: data.txHash };
  } catch (error) {
    // Log error if transaction fails.
    console.error(
      `[${telegram_operation.params.eventId}] Error processing PatchWallet transaction: ${error}`,
    );

    // Check if the instance belongs to specific types (SwapTelegram, TransferTelegram, or VestingTelegram).
    if (
      telegram_operation instanceof SwapTelegram ||
      telegram_operation instanceof TransferTelegram ||
      telegram_operation instanceof VestingTelegram
    ) {
      // Retrieve the response status from the error object, if available.
      const status = error?.response?.status;

      // Check if the status falls within handled error codes.
      if ([470, 400, 503].includes(status)) {
        // If the status is a handled error code, update the database accordingly.
        await telegram_operation.updateInDatabase(
          status === 503
            ? TRANSACTION_STATUS.FAILURE_503
            : TRANSACTION_STATUS.FAILURE,
          new Date(),
        );

        // Return indicating an error occurred during the transaction.
        return { isError: true };
      }

      // Return indicating no error for the specified transaction types.
      return { isError: false };
    }

    // Return indicating an error for other transaction types.
    return { isError: true };
  }
}

export async function getStatus(
  telegram_operation: TelegramOperations,
): Promise<PatchResult> {
  try {
    // Retrieve the status of the PatchWallet transaction
    const res = await getTxStatus(telegram_operation.userOpHash);

    return {
      isError: false,
      userOpHash: res.data.userOpHash,
      txHash: res.data.txHash,
    };
  } catch (error) {
    // Log error if retrieving transaction status fails
    console.error(
      `[${telegram_operation.eventId}] Error processing PatchWallet transaction status: ${error}`,
    );
    // Return true if the error status is 470, marking the transaction as failed
    return (
      (error?.response?.status === 470 &&
        (await telegram_operation.updateInDatabase(
          TRANSACTION_STATUS.FAILURE,
          new Date(),
        ),
        { isError: true })) || { isError: false }
    );
  }
}
