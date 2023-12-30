import { Database } from '../db/conn';
import {
  PatchResult,
  TransactionParams,
  createTransaction,
} from '../types/webhook.types';
import { TRANSACTION_STATUS, USERS_COLLECTION } from '../utils/constants';
import { sendTelegramMessage } from '../utils/telegram';
import { TransferTelegram, createTransferTelegram } from '../utils/transfers';
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
export async function handleNewTransaction(
  params: TransactionParams,
): Promise<boolean> {
  // Establish a connection to the database
  const db = await Database.getInstance();

  // Retrieve sender information from the "users" collection
  const senderInformation = await db
    ?.collection(USERS_COLLECTION)
    .findOne({ userTelegramID: params.senderTgId });
  if (!senderInformation)
    return (
      console.error(
        `[${params.eventId}] Sender ${params.senderTgId} is not a user`,
      ),
      true
    );

  // Create a transfer object
  // let transfer = await createTransferTelegram({ ...params, senderInformation });
  let transfer = await createTransferTelegram(
    createTransaction(params, senderInformation),
  );
  if (!transfer) return false;

  transfer = transfer as TransferTelegram;
  if (
    isSuccessfulTransaction(transfer.status) ||
    isFailedTransaction(transfer.status)
  )
    return true;

  let tx: PatchResult | undefined;

  // Handle pending hash status
  if (isPendingTransactionHash(transfer.status)) {
    if (await isTreatmentDurationExceeded(transfer)) return true;

    // Check userOpHash and updateInDatabase for success
    if (!transfer.userOpHash)
      return (
        await transfer.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
        true
      );

    // Check status for userOpHash and return the status if it's retrieved successfully or false if failed
    tx = await getStatus(transfer);
    if (tx.isError) return true;
    if (!tx.txHash && !tx.userOpHash) return false;
  }

  // Handle sending transaction if not already handled
  if (!tx) {
    tx = await sendTransaction(transfer);
    if (tx.isError) return true;
    if (!tx.txHash && !tx.userOpHash) return false;
  }

  // Finalize transaction handling
  if (tx && tx.txHash) {
    updateTxHash(transfer, tx.txHash);
    await Promise.all([
      transfer.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
      transfer.saveToSegment(),
      transfer.saveToFlowXO(),
      params.message &&
        senderInformation.telegramSession &&
        sendTelegramMessage(
          params.message,
          params.recipientTgId,
          senderInformation,
        ).then(
          (result) =>
            result.success ||
            console.error('Error sending telegram message:', result.message),
        ),
    ]).catch((error) =>
      console.error(
        `[${params.eventId}] Error processing Segment or FlowXO webhook, or sending telegram message: ${error}`,
      ),
    );

    console.log(
      `[${transfer.txHash}] transaction from ${transfer.params.senderInformation?.senderTgId} to ${transfer.params.recipientTgId} for ${transfer.params.amount} with event ID ${transfer.eventId} finished.`,
    );
    return true;
  }

  // Handle pending hash for userOpHash
  tx &&
    tx.userOpHash &&
    updateUserOpHash(transfer, tx.userOpHash) &&
    (await transfer.updateInDatabase(TRANSACTION_STATUS.PENDING_HASH, null));

  return false;
}
