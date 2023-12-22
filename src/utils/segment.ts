/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosError } from 'axios';
import { SEGMENT_KEY } from '../../secrets';
import { SEGMENT_IDENTITY_URL, SEGMENT_TRACK_URL } from './constants';
import { VestingSegmentParams } from '../types/hedgey.types';
import {
  IdentitySegmentParams,
  TrackSegmentParams,
  TrackSwapSegmentParams,
} from '../types/webhook.types';

/**
 * Adds an identity segment using the provided user data.
 * @param user The user data to identify and add to the segment.
 * @returns A Promise resolving to an AxiosResponse.
 */
export async function addIdentitySegment(
  user: IdentitySegmentParams,
): Promise<axios.AxiosResponse<any, AxiosError>> {
  return await axios.post(
    SEGMENT_IDENTITY_URL,
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
export async function addTrackSegment(
  params: TrackSegmentParams,
): Promise<axios.AxiosResponse<any, AxiosError>> {
  return await axios.post(
    SEGMENT_TRACK_URL,
    {
      userId: params.senderTgId,
      event: 'Transfer',
      properties: {
        chainId: params.chainId,
        tokenSymbol: params.tokenSymbol,
        tokenAddress: params.tokenAddress,
        senderTgId: params.senderTgId,
        senderWallet: params.senderInformation.patchwallet,
        senderHandle: params.senderInformation.userHandle,
        senderName: params.senderInformation.userName,
        recipientTgId: params.recipientTgId,
        recipientWallet: params.recipientWallet,
        tokenAmount: params.amount,
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
 * Adds a track segment for a transfer event using the provided parameters.
 * @param params The parameters for the transfer event to track.
 * @returns A Promise resolving to an AxiosResponse.
 */
export async function addVestingSegment(
  params: VestingSegmentParams,
): Promise<axios.AxiosResponse<any, AxiosError>> {
  return await axios.post(
    SEGMENT_TRACK_URL,
    {
      userId: params.senderTgId,
      event: 'Vesting',
      properties: {
        chainId: params.chainId,
        tokenSymbol: params.tokenSymbol,
        tokenAddress: params.tokenAddress,
        senderTgId: params.senderTgId,
        senderWallet: params.senderInformation.patchwallet,
        senderHandle: params.senderInformation.userHandle,
        senderName: params.senderInformation.userName,
        recipients: params.recipients,
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
export async function addTrackSwapSegment(
  params: TrackSwapSegmentParams,
): Promise<axios.AxiosResponse<any, AxiosError>> {
  return await axios.post(
    SEGMENT_TRACK_URL,
    {
      userId: params.userTelegramID,
      event: 'Swap',
      properties: {
        eventId: params.eventId,
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
        chainIn: params.chainIn,
        chainOut: params.chainOut,
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
