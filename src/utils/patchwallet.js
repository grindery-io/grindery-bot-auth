import axios from 'axios';
import Web3 from 'web3';
import ERC20 from '../routes/abi/ERC20.json' assert { type: 'json' };
import { CLIENT_ID, CLIENT_SECRET, G1_POLYGON_ADDRESS } from '../../secrets.js';

export async function getPatchWalletAccessToken() {
  return (
    await axios.post(
      'https://paymagicapi.com/v1/auth',
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
      {
        timeout: 100000,
      }
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
      }
    )
  ).data.users[0].accountAddress;
}

export async function sendTokens(
  senderTgId,
  recipientwallet,
  amountEther,
  patchWalletAccessToken,
  tokenAddress,
  chainName
) {
  const g1Contract = new new Web3().eth.Contract(
    ERC20,
    tokenAddress ? tokenAddress : G1_POLYGON_ADDRESS
  );
  return await axios.post(
    'https://paymagicapi.com/v1/kernel/tx',
    {
      userId: `grindery:${senderTgId}`,
      chain: chainName ? chainName : 'matic',
      to: [tokenAddress ? tokenAddress : G1_POLYGON_ADDRESS],
      value: ['0x00'],
      data: [
        g1Contract.methods['transfer'](
          recipientwallet,
          Web3.utils.toWei(amountEther)
        ).encodeABI(),
      ],
      auth: '',
    },
    {
      timeout: 100000,
      headers: {
        Authorization: `Bearer ${patchWalletAccessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

export async function getTxStatus(userOpHash) {
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
    }
  );
}

export async function swapTokens(
  userTelegramID,
  to,
  value,
  data,
  chainName,
  patchWalletAccessToken
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
    }
  );
}
