import axios, { AxiosError } from 'axios';
import {
  G1_POLYGON_ADDRESS,
  getClientId,
  getClientSecret,
} from '../../secrets';
import { getContract, scaleDecimals } from './web3';
import {
  DEFAULT_CHAIN_ID,
  HEDGEY_BATCHPLANNER_ADDRESS,
  PATCHWALLET_AUTH_URL,
  PATCHWALLET_RESOLVER_URL,
  PATCHWALLET_TX_STATUS_URL,
  PATCHWALLET_TX_URL,
  nativeTokenAddresses,
} from './constants';
import { PatchRawResult } from '../types/webhook.types';
import { HedgeyRecipientParams } from '../types/hedgey.types';
import { getData, getPlans } from './vesting';
import { CHAIN_MAPPING } from './chains';

/**
 * Retrieves the Patch Wallet access token by making a POST request to the authentication endpoint.
 * @returns {Promise<string>} - A Promise resolving to the Patch Wallet access token.
 * @throws {Error} - Throws an error if there's an issue with the request or authentication process.
 */
export async function getPatchWalletAccessToken(): Promise<string> {
  return (
    await axios.post(
      PATCHWALLET_AUTH_URL,
      {
        client_id: await getClientId(),
        client_secret: await getClientSecret(),
      },
      {
        timeout: 100000,
      },
    )
  ).data.access_token;
}

/**
 * Retrieves the Patch Wallet address associated with a given Telegram ID by making a POST request to the resolver endpoint.
 * @param {string} tgId - The Telegram ID for which the associated Patch Wallet address is to be fetched.
 * @returns {Promise<string>} - A Promise resolving to the Patch Wallet address associated with the provided Telegram ID.
 * @throws {Error} - Throws an error if there's an issue with the request or fetching the wallet address.
 */
export async function getPatchWalletAddressFromTgId(
  tgId: string,
): Promise<string> {
  return (
    await axios.post(
      PATCHWALLET_RESOLVER_URL,
      {
        userIds: `grindery:${tgId}`,
      },
      {
        timeout: 100000,
      },
    )
  ).data.users[0].accountAddress;
}

/**
 * Sends tokens from one wallet to another using the PayMagic API.
 * @param {string} senderTgId - Sender's Telegram ID.
 * @param {string} recipientwallet - Recipient's wallet address.
 * @param {string} amountEther - Amount of tokens to send.
 * @param {string} patchWalletAccessToken - Access token for Patch Wallet API.
 * @param {string} tokenAddress - Token address (default: G1_POLYGON_ADDRESS).
 * @param {string} chainId - ID of the blockchain (default: 'eip155:137').
 * @returns {Promise<axios.AxiosResponse<PatchRawResult, AxiosError>>} - Promise resolving to the response from the PayMagic API.
 */
export async function sendTokens(
  senderTgId: string,
  recipientwallet: string,
  amountEther: string,
  patchWalletAccessToken: string,
  delegatecall: 0 | 1,
  tokenAddress: string = G1_POLYGON_ADDRESS,
  chainId: string = DEFAULT_CHAIN_ID,
): Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> {
  // Determine data, value, and address based on the token type
  const [data, value, address] = nativeTokenAddresses.includes(tokenAddress)
    ? ['0x', scaleDecimals(amountEther, 18), recipientwallet]
    : [
        getContract(chainId, tokenAddress)
          .methods['transfer'](
            recipientwallet,
            scaleDecimals(
              amountEther,
              await getContract(chainId, tokenAddress)
                .methods.decimals()
                .call(),
            ),
          )
          .encodeABI(),
        '0x00',
        tokenAddress,
      ];
  // Send the tokens using PayMagic API
  return await callPatchWalletTx(
    senderTgId,
    chainId,
    address,
    value,
    data,
    delegatecall,
    patchWalletAccessToken,
  );
}

/**
 * Retrieves transaction status using the PayMagic API.
 * @param {string} userOpHash - User operation hash.
 * @returns {Promise<axios.AxiosResponse<PatchRawResult, AxiosError>>} - Promise resolving to the response from the PayMagic API.
 */
export async function getTxStatus(
  userOpHash: string | undefined,
): Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> {
  return await axios.post(
    PATCHWALLET_TX_STATUS_URL,
    {
      userOpHash: userOpHash || '',
    },
    {
      timeout: 100000,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );
}

/**
 * Initiates a token swap transaction using the PayMagic API.
 * @param {string} userTelegramID - User's Telegram ID.
 * @param {string} to - Destination address for the token swap.
 * @param {string} value - Value to swap.
 * @param {string} data - Data for the swap transaction.
 * @param {string} chainId - Chain ID (default: 'eip155:137').
 * @param {string} patchWalletAccessToken - Access token for the patch wallet authentication.
 * @returns {Promise<axios.AxiosResponse<PatchRawResult, AxiosError>>} - Promise resolving to the response from the PayMagic API.
 */
export async function swapTokens(
  userTelegramID: string,
  to: string,
  value: string,
  data: string,
  chainIn: string,
  patchWalletAccessToken: string,
  delegatecall: 0 | 1,
): Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> {
  return await callPatchWalletTx(
    userTelegramID,
    chainIn,
    to,
    value,
    data,
    delegatecall,
    patchWalletAccessToken,
  );
}

/**
 * Sends tokens from one wallet to another using the PayMagic API.
 * @param {string} senderTgId - Sender's Telegram ID.
 * @param {string} recipients - Array of Recipients.
 * @param {string} patchWalletAccessToken - Access token for Patch Wallet API.
 * @param {string} tokenAddress - Token address (default: G1_POLYGON_ADDRESS).
 * @param {string} chainId - ID of the blockchain (default: 'eip155:137').
 * @returns {Promise<axios.AxiosResponse<PatchRawResult, AxiosError>>} - Promise resolving to the response from the PayMagic API.
 */
export async function hedgeyLockTokens(
  senderTgId: string | undefined,
  recipients: HedgeyRecipientParams[],
  patchWalletAccessToken: string,
  useVesting: boolean = false,
  tokenAddress: string = G1_POLYGON_ADDRESS,
  chainId: string = DEFAULT_CHAIN_ID,
): Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> {
  const { totalAmount, plans } = await getPlans(recipients);

  // Lock the tokens using PayMagic API
  return await callPatchWalletTx(
    senderTgId || '',
    chainId,
    HEDGEY_BATCHPLANNER_ADDRESS,
    '0x00',
    await getData(useVesting, chainId, tokenAddress, totalAmount, plans),
    0,
    patchWalletAccessToken,
  );
}

/**
 * Initiates a token transaction or operation using the PayMagic API for the Patch Wallet.
 * Constructs and sends a POST request to PATCHWALLET_TX_URL, facilitating various token-related operations.
 * Operations include token transfers, swaps, locking tokens, etc.
 *
 * @param {string} userTelegramID - The Telegram ID of the user initiating the transaction.
 * @param {string} chainId - ID of the blockchain for the transaction (default: 'eip155:137').
 * @param {string} to - Destination address for the transaction.
 * @param {string} value - Value or amount to be transferred or processed.
 * @param {string} data - Data payload associated with the transaction.
 * @param {number} delegatecall - Indicator for delegate call (0 or 1).
 * @param {string} patchWalletAccessToken - Access token for Patch Wallet API authentication.
 * @returns {Promise<AxiosResponse<PatchRawResult, AxiosError>>} - A Promise resolving to the response from the PayMagic API.
 *
 * @throws {Error} - Throws an error if there's an issue with the request or authentication process.
 * This function acts as a versatile utility for interacting with the Patch Wallet API,
 * enabling diverse token-related operations through PayMagic's endpoints.
 */
async function callPatchWalletTx(
  userTelegramID: string,
  chainId: string,
  to: string,
  value: string,
  data: string,
  delegatecall: number,
  patchWalletAccessToken: string,
): Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> {
  return await axios.post(
    PATCHWALLET_TX_URL,
    {
      userId: `grindery:${userTelegramID}`,
      chain: chainId
        ? CHAIN_MAPPING[chainId].name_patch
        : CHAIN_MAPPING[DEFAULT_CHAIN_ID].name_patch,
      to: [to],
      value: [value],
      data: [data],
      delegatecall: delegatecall,
      auth: '',
    },
    {
      timeout: 100000,
      headers: {
        Authorization: `Bearer ${patchWalletAccessToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
}
