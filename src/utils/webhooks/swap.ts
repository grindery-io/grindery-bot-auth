import { TRANSACTION_STATUS, USERS_COLLECTION } from '../constants';
import { Database } from '../../db/conn';
import { SwapParams, createSwapTelegram } from '../swap';
import {
  isFailedTransaction,
  isPendingTransactionHash,
  isSuccessfulTransaction,
  isTreatmentDurationExceeded,
  updateTxHash,
  updateUserOpHash,
} from './utils';

export async function handleSwap(params: SwapParams): Promise<boolean> {
  const db = await Database.getInstance();

  const userInformation = await db
    .collection(USERS_COLLECTION)
    .findOne({ userTelegramID: params.userTelegramID });

  if (!userInformation) {
    console.error(
      `[SWAP EVENT] event id [${params.eventId}] User Telegram Id [${params.userTelegramID}] is not a user`,
    );
    return true;
  }

  const swap = await createSwapTelegram({ ...params, userInformation });
  swap;

  if (isSuccessfulTransaction(swap.status) || isFailedTransaction(swap.status))
    return true;

  let tx;

  // Handle pending hash status
  if (isPendingTransactionHash(swap.status)) {
    if (await isTreatmentDurationExceeded(swap)) return true;

    // Check userOpHash and updateInDatabase for success
    if (!swap.userOpHash)
      return (
        await swap.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
        true
      );

    // Check status for userOpHash
    if ((tx = await swap.getStatus()) === true || tx == false) return tx;
  }

  // Handle sending transaction if not already handled
  if (!tx && ((tx = await swap.swapTokens()) === true || tx == false))
    return tx;

  // Finalize transaction handling
  if (tx && tx.data.txHash) {
    updateTxHash(swap, tx.data.txHash);
    await Promise.all([
      swap.updateInDatabase(TRANSACTION_STATUS.SUCCESS, new Date()),
      swap.saveToSegment(),
      swap.saveToFlowXO(),
    ]).catch((error) =>
      console.error(
        `[${params.eventId}] Error processing Segment or FlowXO webhook: ${error}`,
      ),
    );

    console.log(
      `[${swap.txHash}] swap event [${tx.data.txHash}] from ${params.userTelegramID} finished finished.`,
    );
    return true;
  }

  // Handle pending hash for userOpHash
  tx &&
    tx.data.userOpHash &&
    updateUserOpHash(swap, tx.data.userOpHash) &&
    (await swap.updateInDatabase(TRANSACTION_STATUS.PENDING_HASH, null));

  return false;
}
