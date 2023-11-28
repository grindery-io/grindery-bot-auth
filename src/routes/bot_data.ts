import Web3 from 'web3';
import express from 'express';
import ERC20 from './abi/ERC20.json';
import BigNumber from 'bignumber';
import { CHAIN_MAPPING } from '../utils/chains';
import { authenticateApiKey } from '../utils/auth';
import {
  getPatchWalletAccessToken,
  getPatchWalletAddressFromTgId,
  sendTokens,
} from '../utils/patchwallet';

const router = express.Router();

/**
 * POST /v1/data/
 *
 * @summary Encode Function Call to ERC20 ABI Data
 * @description Convert a function call and its arguments into an ABI-encoded data for ERC20 smart contracts.
 * @tags Data
 * @param {object} request.body - The request body containing necessary information.
 * @return {object} 200 - Success response
 * @return {object} 400 - Error response
 * @example request - 200 - Example request body
 * {
 *   "contractAddress": "0xfe4F5145f6e09952a5ba9e956ED0C25e3Fa4c7F1",
 *   "function": "transfer",
 *   "inputs": ["0x5c9fAf85F1bCFF9aE11F1f60ADEeBD1f851469a5", "1"]
 * }
 * @example response - 200 - Success response example
 * {
 *   "encodedData": "0x..."
 * }
 * @example response - 400 - Error response example
 * {
 *   "error": "Function not found in contract ABI."
 * }
 */
router.post('/', async (req, res) => {
  try {
    const web3 = new Web3();
    const contract = new web3.eth.Contract(
      ERC20 as any,
      req.body.contractAddress,
    );

    const targetFunction = contract.methods[req.body.function];
    if (!targetFunction) {
      return res
        .status(400)
        .json({ error: 'Function not found in contract ABI.' });
    }

    const inputArguments = req.body.inputs || [];

    return res
      .status(200)
      .json({ encodedData: targetFunction(...inputArguments).encodeABI() });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/balance', async (req, res) => {
  try {
    // Check for the presence of all required fields in the request body
    const requiredFields = ['chainId', 'contractAddress', 'userAddress'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          message: `Missing required field: ${field}`,
        });
      }
    }

    // Check if the chainId is valid
    if (!CHAIN_MAPPING[req.body.chainId]) {
      return res.status(400).json({
        message: 'Invalid chainId provided.',
      });
    }

    // Check if the wallet address is valid
    if (!Web3.utils.isAddress(req.body.userAddress)) {
      return res.status(400).json({
        message: 'Provided wallet address is not a valid address.',
      });
    }

    const web3 = new Web3(CHAIN_MAPPING[req.body.chainId][1]);
    const contract = new web3.eth.Contract(
      ERC20 as any,
      req.body.contractAddress,
    );

    const balance = await contract.methods
      .balanceOf(req.body.userAddress)
      .call();

    return res.status(200).json({
      balanceWei: balance,
      balanceEther: BigNumber(balance)
        .div(
          BigNumber(10).pow(
            BigNumber(await contract.methods.decimals().call()),
          ),
        )
        .toString(),
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/patchwallet', async (req, res) => {
  try {
    // Check for the presence of all required fields in the request body
    const requiredFields = ['chainId', 'contractAddress', 'tgId'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({
          message: `Missing required field: ${field}`,
        });
      }
    }

    // Check if the chainId is valid
    if (!CHAIN_MAPPING[req.body.chainId]) {
      return res.status(400).json({
        message: 'Invalid chainId provided.',
      });
    }

    // Check if the contract address is a valid address
    if (!Web3.utils.isAddress(req.body.contractAddress)) {
      return res.status(400).json({
        message: 'Invalid contract address provided.',
      });
    }

    const web3 = new Web3(CHAIN_MAPPING[req.body.chainId][1]);
    const contract = new web3.eth.Contract(
      ERC20 as any,
      req.body.contractAddress,
    );

    const patchWalletAddress = await getPatchWalletAddressFromTgId(
      req.body.tgId,
    );

    const balance = await contract.methods.balanceOf(patchWalletAddress).call();

    return res.status(200).json({
      balanceWei: balance,
      balanceEther: BigNumber(balance)
        .div(
          BigNumber(10).pow(
            BigNumber(await contract.methods.decimals().call()),
          ),
        )
        .toString(),
      patchWalletAddress,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

router.post('/sendTokens', authenticateApiKey, async (req, res) => {
  try {
    return res
      .status(200)
      .json(
        (
          await sendTokens(
            req.body.tgId,
            await getPatchWalletAddressFromTgId(req.body.toTgId),
            req.body.amount,
            await getPatchWalletAccessToken(),
          )
        ).data,
      );
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
