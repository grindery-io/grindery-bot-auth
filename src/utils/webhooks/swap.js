import {
  SWAPS_COLLECTION,
  TRANSACTION_STATUS,
  USERS_COLLECTION,
} from '../constants.js';
import {
  getPatchWalletAccessToken,
  getTxStatus,
  swapTokens,
} from '../patchwallet.js';
import { swap_helpers } from '../swapHelpers.js';
import { Database } from '../../db/conn.js';
import axios from 'axios';
import { addTrackSwapSegment } from '../segment.js';
import { FLOWXO_NEW_SWAP_WEBHOOK } from '../../../secrets.js';

export async function handleSwap(params) {
  const db = await Database.getInstance();

  const userInformation = await db
    .collection(USERS_COLLECTION)
    .findOne({ userTelegramID: params.userTelegramID });

  if (!userInformation) {
    console.error(
      `[SWAP EVENT] event id [${params.eventId}] User Telegram Id [${params.userTelegramID}] is not a user`
    );
    return true;
  }

  const swap_db = await db
    .collection(SWAPS_COLLECTION)
    .findOne({ eventId: params.eventId });

  if (!swap_db) {
    const toSave = {
      chainId: 'eip155:137',
      to: params.to,
      from: params.from,
      userTelegramID: params.userTelegramID,
      tokenInSymbol: params.tokenInSymbol,
      tokenIn: params.tokenIn,
      amountIn: params.amountIn,
      tokenOutSymbol: params.tokenOutSymbol,
      tokenOut: params.tokenOut,
      amountOut: params.amountOut,
      priceImpact: params.priceImpact,
      gas: params.gas,
      eventId: params.eventId,
      status: TRANSACTION_STATUS.PENDING,
      dateAdded: new Date(),
    };

    console.log(
      `[SWAP EVENT] event id [${params.eventId}] swap from user telegram id [${params.userTelegramID}] added to MongoDB as pending.`
    );

    await swap_helpers.insertSwapDB(db, toSave);
  }

  if (swap_db?.status === TRANSACTION_STATUS.SUCCESS) {
    console.log(
      `[SWAP EVENT] event id [${params.eventId}] user telegram id [${params.userTelegramID}] already swap tokens.`
    );
    return true;
  }

  if (swap_db?.status === TRANSACTION_STATUS.FAILURE) {
    console.log(
      `[SWAP EVENT] transaction hash [${swap_db?.transactionHash}] with event ID [${swap_db?.eventId}] is already a failure.`
    );
    return true;
  }

  let tx = undefined;

  if (swap_db?.status === TRANSACTION_STATUS.PENDING_HASH) {
    if (swap_db.dateAdded < new Date(new Date() - 10 * 60 * 1000)) {
      console.log(
        `[SWAP EVENT] event id [${params.eventId}] was stopped due to too long treatment duration (> 10 min).`
      );

      await db.collection(SWAPS_COLLECTION).updateOne(
        { eventId: params.eventId },
        {
          $set: {
            userWallet: userInformation.patchwallet,
            userName: userInformation.userName,
            userHandle: userInformation.userHandle,
            status: TRANSACTION_STATUS.FAILURE,
          },
        },
        { upsert: true }
      );

      return true;
    }

    if (swap_db?.userOpHash) {
      try {
        tx = await getTxStatus(swap_db.userOpHash);
      } catch (error) {
        console.error(
          `[SWAP EVENT] event id [${params.eventId}] Error processing PatchWallet swap status: ${error}`
        );
        if (error?.response?.status === 470) {
          await db.collection(SWAPS_COLLECTION).updateOne(
            { eventId: params.eventId },
            {
              $set: {
                userWallet: userInformation.patchwallet,
                userName: userInformation.userName,
                userHandle: userInformation.userHandle,
                status: TRANSACTION_STATUS.FAILURE,
              },
            },
            { upsert: true }
          );
          return true;
        }
        return false;
      }
    } else {
      await db.collection(SWAPS_COLLECTION).updateOne(
        { eventId: params.eventId },
        {
          $set: {
            userWallet: userInformation.patchwallet,
            userName: userInformation.userName,
            userHandle: userInformation.userHandle,
            status: TRANSACTION_STATUS.SUCCESS,
          },
        },
        { upsert: true }
      );
      return true;
    }
  }

  if (!tx) {
    try {
      tx = await swapTokens(
        params.userTelegramID,
        params.to,
        params.value,
        params.data,
        await getPatchWalletAccessToken()
      );
    } catch (error) {
      console.error(
        `[SWAP EVENT] event id [${params.eventId}] Error processing PatchWallet swap for user telegram id [${params.userTelegramID}]: ${error.message}`
      );
      let drop = false;
      if (!/^\d+$/.test(params.value.toString())) {
        console.warn(`Potentially invalid amount: ${params.amount}, dropping`);
        drop = true;
      }
      if (error?.response?.status === 470 || error?.response?.status === 400) {
        drop = true;
      }
      if (drop) {
        await db.collection(SWAPS_COLLECTION).updateOne(
          { eventId: params.eventId },
          {
            $set: {
              userWallet: userInformation.patchwallet,
              userName: userInformation.userName,
              userHandle: userInformation.userHandle,
              status: TRANSACTION_STATUS.FAILURE,
            },
          },
          { upsert: true }
        );
        return true;
      }
      return false;
    }
  }

  if (tx.data.txHash) {
    const dateAdded = new Date();

    await db.collection(SWAPS_COLLECTION).updateOne(
      { eventId: params.eventId },
      {
        $set: {
          TxId: tx.data.txHash.substring(1, 8),
          transactionHash: tx.data.txHash,
          userWallet: userInformation.patchwallet,
          userName: userInformation.userName,
          userHandle: userInformation.userHandle,
          status: TRANSACTION_STATUS.SUCCESS,
        },
      },
      { upsert: true }
    );

    console.log(
      `[SWAP EVENT] transaction hash [${tx.data.txHash}] swap with event ID ${params.eventId}`
    );

    try {
      await addTrackSwapSegment({
        eventId: params.eventId,
        chainId: 'eip155:137',
        userTelegramID: params.userTelegramID,
        userWallet: userInformation.patchwallet,
        userName: userInformation.userName,
        userHandle: userInformation.userHandle,
        tokenIn: params.tokenIn,
        amountIn: params.amountIn,
        tokenOut: params.tokenOut,
        amountOut: params.amountOut,
        priceImpact: params.priceImpact,
        gas: params.gas,
        status: TRANSACTION_STATUS.SUCCESS,
        TxId: tx.data.txHash.substring(1, 8),
        transactionHash: tx.data.txHash,
        dateAdded: dateAdded,
        to: params.to,
        from: params.from,
        tokenInSymbol: params.tokenInSymbol,
        tokenOutSymbol: params.tokenOutSymbol,
      });

      console.log(
        `[SWAP EVENT] transaction hash [${tx.data.txHash}] with event ID [${params.eventId}] from ${params.senderTgId} added to Segment.`
      );

      await axios.post(FLOWXO_NEW_SWAP_WEBHOOK, {
        eventId: params.eventId,
        chainId: 'eip155:137',
        userTelegramID: params.userTelegramID,
        userWallet: userInformation.patchwallet,
        userName: userInformation.userName,
        userHandle: userInformation.userHandle,
        tokenIn: params.tokenIn,
        amountIn: params.amountIn,
        tokenOut: params.tokenOut,
        amountOut: params.amountOut,
        priceImpact: params.priceImpact,
        gas: params.gas,
        status: TRANSACTION_STATUS.SUCCESS,
        TxId: tx.data.txHash.substring(1, 8),
        transactionHash: tx.data.txHash,
        dateAdded: dateAdded,
        to: params.to,
        from: params.from,
        tokenInSymbol: params.tokenInSymbol,
        tokenOutSymbol: params.tokenOutSymbol,
      });

      console.log(
        `[SWAP EVENT] transaction hash [${tx.data.txHash}] with event ID [${params.eventId}] from ${params.senderTgId} sent to FlowXO.`
      );
    } catch (error) {
      console.error(
        `[SWAP EVENT] event id [${params.eventId}] Error processing Segment or FlowXO webhook, or sending telegram message: ${error}`
      );
    }

    console.log(
      `[SWAP EVENT] transaction hash [${tx.data.txHash}] from ${params.userTelegramID} finished.`
    );
    return true;
  }

  if (tx.data.userOpHash) {
    await db.collection(SWAPS_COLLECTION).updateOne(
      { eventId: params.eventId },
      {
        $set: {
          chainId: 'eip155:137',
          userWallet: userInformation.patchwallet,
          userName: userInformation.userName,
          userHandle: userInformation.userHandle,
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: tx.data.userOpHash,
        },
      },
      { upsert: true }
    );

    console.log(
      `[SWAP EVENT] user op hash [${tx.data.userOpHash}] transaction added to Mongo DB with event ID [${params.eventId}].`
    );
  }

  return false;
}
