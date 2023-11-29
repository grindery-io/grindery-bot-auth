import axios from 'axios';
import {
  G1_POLYGON_ADDRESS,
  getClientId,
  getClientSecret,
} from '../../secrets';
import { getContract, scaleDecimals } from './web3';
import { nativeTokenAddresses } from './constants';

export async function getPatchWalletAccessToken() {
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

export async function getPatchWalletAddressFromTgId(tgId) {
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

export async function sendTokens(
  senderTgId: string,
  recipientwallet: string,
  amountEther: any,
  patchWalletAccessToken: any,
  tokenAddress = G1_POLYGON_ADDRESS,
  chainName = 'matic',
  chainId = 'eip155:137',
) {
  let data: any[];
  let value: string[];
  let address: string;

  const isNativeToken = nativeTokenAddresses.includes(tokenAddress);

  if (isNativeToken) {
    // Native token logic
    data = ['0x00'];
    value = [scaleDecimals(amountEther, 18)];
    address = recipientwallet;
  } else {
    // ERC20 token logic
    const contract = getContract(chainId, tokenAddress);
    const decimals = await contract.methods.decimals().call();
    const amountFormatted = scaleDecimals(amountEther, decimals);
    data = [
      contract.methods['transfer'](
        recipientwallet,
        amountFormatted,
      ).encodeABI(),
    ];
    value = ['0x00'];
    address = tokenAddress;
  }

  return await axios.post(
    'https://paymagicapi.com/v1/kernel/tx',
    {
      userId: `grindery:${senderTgId}`,
      chain: chainName,
      to: [address],
      value: value,
      data: data,
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

export async function getTxStatus(userOpHash: any) {
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

export async function swapTokens(
  userTelegramID: any,
  to: any,
  value: any,
  data: any,
  chainName: any,
  patchWalletAccessToken: any,
) {
  return await axios.post(
    'https://paymagicapi.com/v1/kernel/tx',
    {
      userId: `grindery:${userTelegramID}`,
      chain: chainName ? chainName : 'matic',
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
