import { TRANSACTION_STATUS, USERS_COLLECTION } from '../utils/constants';
import { Database } from '../db/conn';
import { createSwapTelegram } from '../utils/swap';
import {
  isFailedTransaction,
  isPendingTransactionHash,
  isSuccessfulTransaction,
  isTreatmentDurationExceeded,
  sendTransaction,
  updateTxHash,
  updateUserOpHash,
} from './utils';
import {
  PatchResult,
  SwapParams,
  createSwapParams,
} from '../types/webhook.types';

/**
 * Handles the swap process based on provided parameters.
 * @param {SwapParams} params - Parameters required for the swap.
 * @returns {Promise<boolean>} - Promise resolving to a boolean indicating success or failure of the swap process.
 */
export async function handleSwap(params: SwapParams): Promise<boolean> {
  // Get the database instance
  const db = await Database.getInstance();

  // Fetch user information from the database based on the provided Telegram ID
  const userInformation = await db
    .collection(USERS_COLLECTION)
    .findOne({ userTelegramID: params.userTelegramID });

  // If user information is not found, log an error and return true indicating handled status
  if (!userInformation) {
    console.error(
      `[SWAP EVENT] Event ID [${params.eventId}] User Telegram ID [${params.userTelegramID}] does not exist in the database.`,
    );
    return true;
  }

  // Create a swap instance using createSwapTelegram function with provided parameters and user information
  const swap = await createSwapTelegram(
    createSwapParams(params, userInformation),
  );

  // If the swap status indicates success or failure, return true indicating handled status
  if (isSuccessfulTransaction(swap.status) || isFailedTransaction(swap.status))
    return true;

  let tx: PatchResult;

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
    tx = await swap.getStatus();
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
