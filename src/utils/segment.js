import 'dotenv/config';
import axios from 'axios';

/**
 * Sends user identity information to Segment.
 * @param {object} user - User identity information.
 * @returns {Promise} Returns a Promise representing the result of the HTTP POST request.
 */
export async function addIdentitySegment(user) {
  return await axios.post(
    'https://api.segment.io/v1/identify',
    {
      userId: user.userTelegramID,
      traits: {
        responsePath: user.responsePath,
        userHandle: user.userHandle,
        userName: user.userName,
        patchwallet: user.patchwallet,
      },
      timestamp: user.dateAdded,
    },
    {
      timeout: 100000,
      headers: {
        Authorization: `Bearer ${process.env.SEGMENT_KEY}`,
      },
    }
  );
}

/**
 * Sends a track event to Segment.
 * @param {object} params - Track event parameters.
 * @returns {Promise} Returns a Promise representing the result of the HTTP POST request.
 */
export async function addTrackSegment(params) {
  return await axios.post(
    'https://api.segment.io/v1/track',
    {
      userId: params.userTelegramID,
      event: 'Transfer',
      properties: {
        chainId: 'eip155:137',
        tokenSymbol: 'g1',
        tokenAddress: process.env.G1_POLYGON_ADDRESS,
        senderTgId: params.senderTgId,
        senderWallet: params.senderWallet,
        senderHandle: params.senderHandle,
        senderName: params.senderName,
        recipientTgId: params.recipientTgId,
        recipientWallet: params.recipientWallet,
        tokenAmount: params.tokenAmount,
        transactionHash: params.transactionHash,
        eventId: params.eventId,
      },
      timestamp: params.dateAdded,
    },
    {
      timeout: 100000,
      headers: {
        Authorization: `Bearer ${process.env.SEGMENT_KEY}`,
      },
    }
  );
}

/**
 * Sends a track event to Segment.
 * @param {object} params - Track event parameters.
 * @returns {Promise} Returns a Promise representing the result of the HTTP POST request.
 */
export async function addTrackSwapSegment(params) {
  return await axios.post(
    'https://api.segment.io/v1/track',
    {
      userId: params.userTelegramID,
      event: 'Swap',
      properties: {
        eventId: params.eventId,
        chainId: params.chainId,
        userTelegramID: params.userTelegramID,
        tokenIn: params.tokenIn,
        amountIn: params.amountIn,
        tokenOut: params.tokenOut,
        amountOut: params.amountOut,
        priceImpact: params.priceImpact,
        gas: params.gas,
        status: params.status,
        TxId: params.TxId,
        transactionHash: params.transactionHash,
        to: params.to,
        from: params.from,
        tokenInSymbol: params.tokenInSymbol,
        tokenOutSymbol: params.tokenOutSymbol,
      },
      timestamp: params.dateAdded,
    },
    {
      timeout: 100000,
      headers: {
        Authorization: `Bearer ${process.env.SEGMENT_KEY}`,
      },
    }
  );
}
