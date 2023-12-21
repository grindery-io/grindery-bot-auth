import express from 'express';
import { authenticateApiKeyLinea } from '../utils/auth';
import { SWAPS_COLLECTION } from '../utils/constants';
import { Database } from '../db/conn';
import axios from 'axios';
import { ANKR_KEY } from '../../secrets';
import { getContract } from '../utils/web3';

const router = express.Router();

/**
 * Represents the response structure expected for getting token price information.
 */
type GetTokenPriceResponseType = {
  /**
   * Identifier for the response.
   */
  id: number;

  /**
   * JSON-RPC protocol version.
   */
  jsonrpc: string;

  /**
   * Result object containing blockchain, contract address, and USD price details.
   */
  result: {
    /**
     * Name of the blockchain.
     */
    blockchain: string;

    /**
     * Address of the smart contract.
     */
    contractAddress: string;

    /**
     * Price of the token in USD.
     */
    usdPrice: string;
  };
};

/**
 * Represents a summary of swap details indexed by token addresses.
 */
interface SwapSummary {
  /**
   * Token address as key mapping to an object containing decimals.
   */
  [tokenAddress: string]: {
    /**
     * Number of decimals for the token.
     */
    decimals: number;
  };
}

router.get('/swaps', authenticateApiKeyLinea, async (req, res) => {
  try {
    const db = await Database.getInstance();

    const swaps = await db
      .collection(SWAPS_COLLECTION)
      .find({
        userTelegramID: req.query.userTelegramID,
        chainId: 'eip155:59144',
      })
      .toArray();

    const swapSummary: SwapSummary = {};

    for (const swap of swaps) {
      if (!swapSummary[swap.tokenIn]) {
        swapSummary[swap.tokenIn] = { decimals: 18 }; // Defaulting decimals to 18 if not obtained
      }
    }

    const promises = Object.keys(swapSummary).map(async (tokenAddress) => {
      try {
        swapSummary[tokenAddress] = {
          decimals: parseInt(
            await getContract('eip155:59144', tokenAddress)
              .methods.decimals()
              .call(),
          ),
        };
      } catch (err) {
        swapSummary[tokenAddress] = { decimals: 18 };
      }
    });

    await Promise.all(promises);

    let totalSwapsValueInUSD = 0;

    // Calculating total tokenIn value for all swaps
    for (const swap of swaps) {
      const tokenInAddress = swap.tokenIn;
      const tokenInAmount = parseFloat(swap.amountIn);
      const tokenInDecimals = swapSummary[tokenInAddress].decimals;

      const tokenPriceRes = await axios.post<GetTokenPriceResponseType>(
        `https://rpc.ankr.com/multichain/${ANKR_KEY || ''}`,
        {
          jsonrpc: '2.0',
          method: 'ankr_getTokenPrice',
          params: {
            blockchain: 'linea',
            contractAddress: tokenInAddress,
          },
          id: new Date().toString(),
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const tokenPrice = parseFloat(
        tokenPriceRes.data?.result?.usdPrice || '0',
      );

      const decimalFactor = 10 ** tokenInDecimals;
      const tokenInValueInUSD = (tokenInAmount / decimalFactor) * tokenPrice;

      totalSwapsValueInUSD += tokenInValueInUSD;
    }

    const isValidAmount = totalSwapsValueInUSD >= 5;

    return res.status(200).json({
      error: {
        code: 0,
        message: '',
      },
      data: {
        result: isValidAmount,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 500,
        message: 'An error occurred',
      },
      data: {
        result: false,
      },
    });
  }
});

export default router;
