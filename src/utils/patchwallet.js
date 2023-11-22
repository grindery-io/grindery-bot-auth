import axios from 'axios';
import Web3 from 'web3';
import ERC20 from '../routes/abi/ERC20.json' assert { type: 'json' };
import {
  G1_POLYGON_ADDRESS,
  getClientId,
  getClientSecret,
} from '../../secrets.js';

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
  patchWalletAccessToken
) {
  const g1Contract = new new Web3().eth.Contract(ERC20, G1_POLYGON_ADDRESS);
  return await axios.post(
    'https://paymagicapi.com/v1/kernel/tx',
    {
      userId: `grindery:${senderTgId}`,
      chain: 'matic',
      to: [G1_POLYGON_ADDRESS],
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
  patchWalletAccessToken
) {
  return await axios.post(
    'https://paymagicapi.com/v1/kernel/tx',
    {
      userId: `grindery:${userTelegramID}`,
      chain: 'matic',
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
