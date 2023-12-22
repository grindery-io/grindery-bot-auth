import {
  PatchResult,
  Reward,
  TelegramOperations,
  TransactionStatus,
} from '../types/webhook.types';
import { TRANSACTION_STATUS } from '../utils/constants';
import { getTxStatus } from '../utils/patchwallet';
import { getXMinBeforeDate } from '../utils/time';

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
 * @param {TelegramOperations} inst - The instance to be checked.
 * @returns {Promise<boolean>} A Promise resolving to a boolean indicating if the treatment duration has exceeded.
 * @throws {Error} Throws an error if there is an issue updating the instance in the database.
 */
export async function isTreatmentDurationExceeded(
  inst: TelegramOperations,
): Promise<boolean> {
  return (
    (inst.tx.dateAdded < getXMinBeforeDate(new Date(), 10) &&
      (console.log(
        `[${inst.eventId}] was stopped due to too long treatment duration (> 10 min).`,
      ),
      await inst.updateInDatabase(TRANSACTION_STATUS.FAILURE, new Date()),
      true)) ||
    false
  );
}

/**
 * Retrieves the status of rewards based on the provided reward instance.
 *
 * @param inst An instance representing various reward types:
 *  - `IsolatedRewardTelegram`
 *  - `LinkRewardTelegram`
 *  - `ReferralRewardTelegram`
 *  - `SignUpRewardTelegram`
 * @returns A Promise that resolves to the status of rewards retrieval.
 *   If successful, returns the status obtained from the transaction; otherwise, returns `false`.
 * @throws Error if there's an issue during the status retrieval process.
 */
export async function getStatusRewards(inst: Reward): Promise<PatchResult> {
  try {
    // Retrieve the status of the PatchWallet transaction
    const status = await getTxStatus(inst.userOpHash);
    return {
      isError: false,
      userOpHash: status.data.userOpHash,
      txHash: status.data.txHash,
    };
  } catch (error) {
    // Log error if retrieving transaction status fails
    console.error(
      `[${inst.eventId}] Error processing PatchWallet transaction status: ${error}`,
    );
    return { isError: true };
  }
}

/**
 * Updates the userOpHash property of a reward telegram instance.
 * @param inst The reward telegram instance.
 * @param userOpHash The user operation hash to update.
 * @returns The updated user operation hash.
 */
export function updateUserOpHash(
  inst: TelegramOperations,
  userOpHash: string,
): string {
  return (inst.userOpHash = userOpHash);
}

/**
 * Updates the txHash property of a reward telegram instance.
 * @param inst The reward telegram instance.
 * @param txHash The transaction hash to update.
 * @returns The updated transaction hash.
 */
export function updateTxHash(inst: TelegramOperations, txHash: string): string {
  return (inst.txHash = txHash);
}
