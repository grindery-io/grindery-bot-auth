import axios from 'axios';
import {
  G1_POLYGON_ADDRESS,
  getClientId,
  getClientSecret,
} from '../../secrets';
import { getContract, scaleDecimals } from './web3';
import { nativeTokenAddresses } from './constants';

/**
 * Retrieves the Patch Wallet access token by making a POST request to the authentication endpoint.
 * @returns {Promise<string>} - A Promise resolving to the Patch Wallet access token.
 * @throws {Error} - Throws an error if there's an issue with the request or authentication process.
 */
export async function getPatchWalletAccessToken(): Promise<string> {
  return (
    await axios.post(
      'https://paymagicapi.com/v1/auth',
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
      'https://paymagicapi.com/v1/resolver',
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
 * @returns {Promise<axios.AxiosResponse<any, any>>} - Promise resolving to the response from the PayMagic API.
 */
export async function sendTokens(
  senderTgId: string,
  recipientwallet: string,
  amountEther: string,
  patchWalletAccessToken: string,
  tokenAddress: string = G1_POLYGON_ADDRESS,
  chainName: string = 'matic',
  chainId: string = 'eip155:137',
): Promise<axios.AxiosResponse<any, any>> {
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
    'https://paymagicapi.com/v1/kernel/tx',
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
 * @returns {Promise<axios.AxiosResponse<any, any>>} - Promise resolving to the response from the PayMagic API.
 */
export async function getTxStatus(
  userOpHash: string,
): Promise<axios.AxiosResponse<any, any>> {
  return await axios.post(
    'https://paymagicapi.com/v1/kernel/txStatus',
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
 * @param {string} chainName - Name of the chain (default: 'matic').
 * @param {string} patchWalletAccessToken - Access token for the patch wallet authentication.
 * @returns {Promise<axios.AxiosResponse<any, any>>} - Promise resolving to the response from the PayMagic API.
 */
export async function swapTokens(
  userTelegramID: string,
  to: string,
  value: string,
  data: string,
  chainId: string,
  patchWalletAccessToken: string,
): Promise<axios.AxiosResponse<any, any>> {
  return await axios.post(
    'https://paymagicapi.com/v1/kernel/tx',
    {
      userId: `grindery:${userTelegramID}`,
      chain: chainId ? chainId : 'eip155:137',
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
