import axios, { AxiosError } from 'axios';
import {
  G1_POLYGON_ADDRESS,
  getClientId,
  getClientSecret,
} from '../../secrets';
import {
  getContract,
  getHedgeyBatchPlannerContract,
  scaleDecimals,
} from './web3';
import {
  DEFAULT_CHAIN_ID,
  DEFAULT_CHAIN_NAME,
  GRINDERY_VESTING_ADMIN,
  HEDGEY_BATCHPLANNER_ADDRESS,
  HEDGEY_LOCKUP_LOCKER,
  HEDGEY_VESTING_LOCKER,
  IDO_START_DATE,
  PATCHWALLET_AUTH_URL,
  PATCHWALLET_RESOLVER_URL,
  PATCHWALLET_TX_STATUS_URL,
  PATCHWALLET_TX_URL,
  TOKEN_LOCK_TERM,
  nativeTokenAddresses,
} from './constants';
import { PatchRawResult } from '../types/webhook.types';
import { CHAIN_NAME_MAPPING } from './chains';
import { HedgeyPlanParams, HedgeyRecipientParams } from '../types/hedgey.types';

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
 * @param {string} chainName - Name of the blockchain (default: 'matic').
 * @param {string} chainId - ID of the blockchain (default: 'eip155:137').
 * @returns {Promise<axios.AxiosResponse<PatchRawResult, AxiosError>>} - Promise resolving to the response from the PayMagic API.
 */
export async function sendTokens(
  senderTgId: string,
  recipientwallet: string,
  amountEther: string,
  patchWalletAccessToken: string,
  tokenAddress: string = G1_POLYGON_ADDRESS,
  chainName: string = DEFAULT_CHAIN_NAME,
  chainId: string = DEFAULT_CHAIN_ID,
): Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> {
  // Determine data, value, and address based on the token type
  const [data, value, address] = nativeTokenAddresses.includes(tokenAddress)
    ? [['0x'], [scaleDecimals(amountEther, 18)], recipientwallet]
    : [
        [
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
        ],
        ['0x00'],
        tokenAddress,
      ];

  // Send the tokens using PayMagic API
  return await axios.post(
    PATCHWALLET_TX_URL,
    {
      userId: `grindery:${senderTgId}`,
      chain: chainName,
      to: [address],
      value: value,
      data: data,
      delegatecall: 0,
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

/**
 * Retrieves transaction status using the PayMagic API.
 * @param {string} userOpHash - User operation hash.
 * @returns {Promise<axios.AxiosResponse<PatchRawResult, AxiosError>>} - Promise resolving to the response from the PayMagic API.
 */
export async function getTxStatus(
  userOpHash: string,
): Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> {
  return await axios.post(
    PATCHWALLET_TX_STATUS_URL,
    {
      userOpHash: userOpHash,
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
  chainId: string,
  patchWalletAccessToken: string,
): Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> {
  return await axios.post(
    PATCHWALLET_TX_URL,
    {
      userId: `grindery:${userTelegramID}`,
      chain: chainId
        ? CHAIN_NAME_MAPPING[chainId]
        : CHAIN_NAME_MAPPING[DEFAULT_CHAIN_ID],
      to: [to],
      value: [value],
      data: [data],
      delegatecall: 1,
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

/**
 * Sends tokens from one wallet to another using the PayMagic API.
 * @param {string} senderTgId - Sender's Telegram ID.
 * @param {string} recipients - Array of Recipients.
 * @param {string} patchWalletAccessToken - Access token for Patch Wallet API.
 * @param {string} tokenAddress - Token address (default: G1_POLYGON_ADDRESS).
 * @param {string} chainName - Name of the blockchain (default: 'matic').
 * @param {string} chainId - ID of the blockchain (default: 'eip155:137').
 * @returns {Promise<axios.AxiosResponse<PatchRawResult, AxiosError>>} - Promise resolving to the response from the PayMagic API.
 */
export async function hedgeyLockTokens(
  senderTgId: string,
  recipients: HedgeyRecipientParams[],
  patchWalletAccessToken: string,
  useVesting: boolean = false,
  tokenAddress: string = G1_POLYGON_ADDRESS,
  chainName: string = DEFAULT_CHAIN_NAME,
  chainId: string = DEFAULT_CHAIN_ID,
): Promise<axios.AxiosResponse<PatchRawResult, AxiosError>> {
  // Populate the remaining fields for each plan and calculate rates
  const startDate = Math.round(IDO_START_DATE.getTime() / 1000); // Could use Date.now() instead of constant
  let totalAmount = 0;

  const plans = (await Promise.all(
    recipients.map(async (plan) => {
      totalAmount += Number(plan.amount);
      return [
        plan.recipientAddress,
        scaleDecimals(
          plan.amount,
          await getContract(chainId, tokenAddress).methods.decimals().call(),
        ),
        startDate,
        startDate, // No cliff
        Math.ceil(Number(plan.amount) / TOKEN_LOCK_TERM), // Rate is tokens unlocked per second
      ] as HedgeyPlanParams;
    }),
  )) as HedgeyPlanParams[];

  // Lock the tokens using PayMagic API
  return await axios.post(
    PATCHWALLET_TX_URL,
    {
      userId: `grindery:${senderTgId}`,
      chain: chainName,
      to: [HEDGEY_BATCHPLANNER_ADDRESS],
      value: ['0x00'],
      data: useVesting
        ? [
            getHedgeyBatchPlannerContract(chainId)
              .methods['batchVestingPlans'](
                HEDGEY_VESTING_LOCKER,
                tokenAddress,
                totalAmount,
                plans,
                1, // Period: Linear
                GRINDERY_VESTING_ADMIN,
                true,
                4, // Vesting (fixed Hedgey constant)
              )
              .encodeABI(),
          ]
        : [
            getHedgeyBatchPlannerContract(chainId)
              .methods['batchLockingPlans'](
                HEDGEY_LOCKUP_LOCKER,
                tokenAddress,
                totalAmount,
                plans,
                1, // Period: Linear
                5, // Investor Lockups (fixed Hedgey constant)
              )
              .encodeABI(),
          ],
      delegatecall: 0,
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
