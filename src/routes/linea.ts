import express from 'express';
import { authenticateApiKeyLinea } from '../utils/auth';
import { SWAPS_COLLECTION } from '../utils/constants';
import { Database } from '../db/conn';
import axios from 'axios';
import { ANKR_KEY } from '../../secrets';

const router = express.Router();

type GetTokenPriceResponseType = {
  id: number;
  jsonrpc: string;
  result: {
    blockchain: string;
    contractAddress: string;
    usdPrice: string;
  };
};

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

    const swapSummary: Record<string, any> = {};

    for (const swap of swaps) {
      if (!swapSummary[swap.tokenIn]) {
        swapSummary[swap.tokenIn] = { decimals: 18 }; // Defaulting decimals to 18 if not obtained
      }
    }

    const promises = Object.keys(swapSummary).map(async (tokenAddress) => {
      const tokenDecimalsRes = await axios.post(
        `https://rpc.ankr.com/multichain/${ANKR_KEY || ''}`,
        {
          jsonrpc: '2.0',
          method: 'ankr_getTokenDecimals',
          params: {
            blockchain: 'linea',
            contractAddress: tokenAddress,
          },
          id: new Date().toString(),
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      const tokenDecimals =
        tokenDecimalsRes.data?.result?.decimals ||
        swapSummary[tokenAddress].decimals ||
        18; // Defaulting to 18 if not obtained
      swapSummary[tokenAddress].decimals = tokenDecimals;
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

    return res.status(200).json({ isValidAmount: totalSwapsValueInUSD >= 5 });
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

export default router;
