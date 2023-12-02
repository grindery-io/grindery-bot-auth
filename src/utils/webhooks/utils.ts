import { TRANSACTION_STATUS } from '../constants';
import { getTxStatus } from '../patchwallet';
import {
  IsolatedRewardTelegram,
  LinkRewardTelegram,
  ReferralRewardTelegram,
  SignUpRewardTelegram,
} from '../rewards';
import { getXMinBeforeDate } from '../time';
import { TransferTelegram } from '../transfers';

/**
 * Checks if the provided status indicates a successful transaction.
 * @param status - The status of the transaction.
 * @returns {boolean} - True if the transaction status represents success, otherwise false.
 */
export function isSuccessfulTransaction(status: string): boolean {
  return status === TRANSACTION_STATUS.SUCCESS;
}

/**
 * Checks if the transaction has failed.
 * @param status - The status of the transaction.
 * @returns {boolean} - True if the transaction has failed, false otherwise.
 */
export function isFailedTransaction(status: string): boolean {
  return status === TRANSACTION_STATUS.FAILURE;
}

/**
 * Checks if the transaction is in the pending hash state.
 * @param status - The status of the transaction.
 * @returns {boolean} - True if the transaction is in the pending hash state, false otherwise.
 */
export function isPendingTransactionHash(status: string): boolean {
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
 * @param {IsolatedRewardTelegram | LinkRewardTelegram | ReferralRewardTelegram | SignUpRewardTelegram | TransferTelegram} inst - The instance to be checked.
 * @returns {Promise<boolean>} A Promise resolving to a boolean indicating if the treatment duration has exceeded.
 * @throws {Error} Throws an error if there is an issue updating the instance in the database.
 */
export async function isTreatmentDurationExceeded(
  inst:
    | IsolatedRewardTelegram
    | LinkRewardTelegram
    | ReferralRewardTelegram
    | SignUpRewardTelegram
    | TransferTelegram,
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
export async function getStatusRewards(
  inst:
    | IsolatedRewardTelegram
    | LinkRewardTelegram
    | ReferralRewardTelegram
    | SignUpRewardTelegram,
): Promise<any> {
  try {
    // Retrieve the status of the PatchWallet transaction
    return await getTxStatus(inst.userOpHash);
  } catch (error) {
    // Log error if retrieving transaction status fails
    console.error(
      `[${inst.eventId}] Error processing PatchWallet transaction status: ${error}`,
    );
    // Return true if the error status is 470, marking the transaction as failed
    return false;
  }
}
