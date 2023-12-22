import express from 'express';
import { authenticateApiKey } from '../utils/auth';
import { computeG1ToGxConversion } from '../utils/g1gx';

const router = express.Router();

/**
 * POST /v1/tge/conversion-information
 *
 * @summary Calculate G1 to Gx conversion
 * @description Calculates the conversion from G1 to Gx based on provided quantities of USD and G1.
 * @tags Conversion
 * @security BearerAuth
 * @param {object} request.body - The request body containing USD and G1 quantities
 * @return {object} 200 - Success response with the calculated conversion value
 * @return {object} 500 - Error response if an error occurs during the conversion
 *
 * @example request - 200 - Example request body
 * {
 *   "usdQuantity": 100,
 *   "g1Quantity": 50
 * }
 *
 * @example response - 200 - Success response example
 * {
 *   "from_usd_investment": 10,
 *   "from_g1_holding": 0.049999999999999996,
 *   "from_mvu": 0.8040000000000014,
 *   "from_time": 1.0442717990890689,
 *   "equivalent_usd_invested": 11.898271799089072,
 *   "before_mvu": 279.1666666666667,
 *   "mvu_effect": 22.33333333333337,
 *   "time_effect": 29.00754997469636,
 *   "equivalent_gx_usd_exchange_rate": 32.88632338056681,
 *   "standard_gx_usd_exchange_rate": 27.77777777777778,
 *   "discount_received": 15.533951739365826
 * }
 *
 * @example response - 500 - Error response example
 * {
 *   "msg": "An error occurred",
 *   "error": "Error details here"
 * }
 */
router.post('/conversion-information', authenticateApiKey, async (req, res) => {
  try {
    return res
      .status(200)
      .json(
        computeG1ToGxConversion(
          Number(req.body.usdQuantity),
          Number(req.body.g1Quantity),
          4,
        ),
      );
  } catch (error) {
    return res.status(500).json({ msg: 'An error occurred', error });
  }
});

export default router;
