import { Database } from '../db/conn';
import { VestingParams, createVesting } from '../types/hedgey.types';
import { PatchResult } from '../types/webhook.types';
import { TRANSACTION_STATUS, USERS_COLLECTION } from '../utils/constants';
import { VestingTelegram, createVestingTelegram } from '../utils/vesting';
import {
  isFailedTransaction,
  isPendingTransactionHash,
  isSuccessfulTransaction,
  isTreatmentDurationExceeded,
  updateTxHash,
  updateUserOpHash,
} from './utils';

/**
 * Handles a new transaction based on the provided parameters.
 * @param params An object containing parameters necessary for handling the transaction.
 * @param params.senderTgId The Telegram ID of the sender initiating the transaction.
 * @param params.amount The amount related to the transaction.
 * @param params.recipientTgId The Telegram ID of the recipient.
 * @param params.eventId The ID of the event related to the transaction.
 * @param params.chainId Optional: The chain ID.
 * @param params.tokenAddress Optional: The token address related to the transaction.
 * @param params.message Optional: A message associated with the transaction.
 * @returns A Promise that resolves to a boolean indicating the success status of the transaction handling process.
 */
export async function handleNewVesting(
  params: VestingParams,
): Promise<boolean> {
  // Establish a connection to the database
  const db = await Database.getInstance();

  // Retrieve sender information from the "users" collection
  const senderInformation = await db
    .collection(USERS_COLLECTION)
    .findOne({ userTelegramID: params.senderTgId });
  if (!senderInformation)
    return (
      console.error(
        `[${params.eventId}] Sender ${params.senderTgId} is not a user`,
      ),
      true
    );

  // Create a vesting object
  // let vesting = await createTransferTelegram({ ...params, senderInformation });
  let vesting = await createVestingTelegram(
    createVesting(params, senderInformation),
  );
  if (!vesting) return false;

  vesting = vesting as VestingTelegram;
  if (
    isSuccessfulTransaction(vesting.status) ||
    isFailedTransaction(vesting.status)
  )
    return true;

  let tx: PatchResult;

  // Handle pending hash status
  if (isPendingTransactionHash(vesting.status)) {
    if (await isTreatmentDurationExceeded(vesting)) return true;

    // Check userOpHash and updateInDatabase for success
    if (!vesting.userOpHash)
      return (
        await vesting.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
        true
      );

    // Check status for userOpHash and return the status if it's retrieved successfully or false if failed
    tx = await vesting.getStatus();
    if (tx.isError) return true;
    if (!tx.txHash && !tx.userOpHash) return false;
  }

  // Handle sending transaction if not already handled
  if (!tx) {
    tx = await vesting.sendTx();
    if (tx.isError) return true;
    if (!tx.txHash && !tx.userOpHash) return false;
  }

  // Finalize transaction handling
  if (tx && tx.txHash) {
    updateTxHash(vesting, tx.txHash);
    await Promise.all([
      vesting.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
      vesting.saveToSegment(),
      vesting.saveToFlowXO(),
    ]).catch((error) =>
      console.error(
        `[${params.eventId}] Error processing Segment or FlowXO webhook, or sending telegram message: ${error}`,
      ),
    );

    console.log(
      `[${vesting.txHash}] vesting from ${vesting.params.senderInformation.senderTgId} with event ID ${vesting.eventId} finished.`,
    );
    return true;
  }

  // Handle pending hash for userOpHash
  tx &&
    tx.userOpHash &&
    updateUserOpHash(vesting, tx.userOpHash) &&
    (await vesting.updateInDatabase(TRANSACTION_STATUS.PENDING_HASH, null));

  return false;
}
