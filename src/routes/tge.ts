import express from 'express';
import { authenticateApiKey } from '../utils/auth';
import { computeG1ToGxConversion } from '../utils/g1gx';

const router = express.Router();

/**
 * GET /v1/tge/conversion-information
 *
 * @summary Calculate G1 to Gx conversion
 * @description Calculates the conversion from G1 to Gx based on provided quantities of USD and G1.
 * @tags Conversion
 * @security BearerAuth
 * @param {number} usdQuantity.query - The quantity of USD.
 * @param {number} g1Quantity.query - The quantity of G1.
 * @return {object} 200 - Success response with the calculated conversion value
 * @return {object} 500 - Error response if an error occurs during the conversion
 *
 * @example request - 200 - Example request query parameters
 * /v1/tge/conversion-information?usdQuantity=100&g1Quantity=50
 *
 * @example response - 200 - Success response example
 * {
 *   "usd_from_usd_investment": "10",
 *   "usd_from_g1_holding": "0.049",
 *   "usd_from_mvu": "0.80",
 *   "usd_from_time": "1.04",
 *   "equivalent_usd_invested": "11.89",
 *   "gx_before_mvu": "279.16",
 *   "gx_mvu_effect": "22.33",
 *   "gx_time_effect": "29.00",
 *   "gx_received": "1200",
 *   "equivalent_gx_usd_exchange_rate": "32.88",
 *   "standard_gx_usd_exchange_rate": "27.77",
 *   "discount_received": "15.53"
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.get('/conversion-information', authenticateApiKey, async (req, res) => {
  try {
    return res
      .status(200)
      .json(
        computeG1ToGxConversion(
          Number(req.query.usdQuantity),
          Number(req.query.g1Quantity),
          4,
        ),
      );
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

export default router;
