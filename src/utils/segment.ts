import axios, { AxiosError } from 'axios';
import { SEGMENT_KEY } from '../../secrets';

/**
 * Adds an identity segment using the provided user data.
 * @param user The user data to identify and add to the segment.
 * @returns A Promise resolving to an AxiosResponse.
 */
export async function addIdentitySegment(user: {
  userTelegramID: string;
  responsePath: string;
  userHandle: string;
  userName: string;
  patchwallet: string;
  dateAdded: Date;
}): Promise<axios.AxiosResponse<any, AxiosError>> {
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
        Authorization: `Bearer ${SEGMENT_KEY}`,
      },
    },
  );
}

/**
 * Adds a track segment for a transfer event using the provided parameters.
 * @param params The parameters for the transfer event to track.
 * @returns A Promise resolving to an AxiosResponse.
 */
export async function addTrackSegment(params: {
  userTelegramID: string;
  senderTgId: string;
  senderWallet: string;
  senderName: string;
  senderHandle: string;
  recipientTgId: string;
  recipientWallet: string;
  tokenAmount: string;
  transactionHash: string;
  dateAdded: Date;
  eventId: string;
  tokenSymbol: string;
  tokenAddress: string;
  chainId: string;
}): Promise<axios.AxiosResponse<any, AxiosError>> {
  return await axios.post(
    'https://api.segment.io/v1/track',
    {
      userId: params.userTelegramID,
      event: 'Transfer',
      properties: {
        chainId: params.chainId,
        tokenSymbol: params.tokenSymbol,
        tokenAddress: params.tokenAddress,
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
        Authorization: `Bearer ${SEGMENT_KEY}`,
      },
    },
  );
}

/**
 * Adds a track segment for a swap event using the provided parameters.
 * @param params The parameters for the swap event to track.
 * @returns A Promise resolving to an AxiosResponse.
 */
export async function addTrackSwapSegment(params: {
  eventId: string;
  chainId: string;
  userTelegramID: string;
  userWallet?: string;
  userName?: string;
  userHandle?: string;
  tokenIn: string;
  amountIn: string;
  tokenOut: string;
  amountOut: string;
  priceImpact: string;
  gas: string;
  status: string;
  transactionHash: string;
  dateAdded: Date;
  to: string;
  from: string;
  tokenInSymbol: string;
  tokenOutSymbol: string;
}): Promise<axios.AxiosResponse<any, AxiosError>> {
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
        Authorization: `Bearer ${SEGMENT_KEY}`,
      },
    },
  );
}
