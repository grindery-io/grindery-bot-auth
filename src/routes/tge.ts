import express from 'express';
import { authenticateApiKey } from '../utils/auth';
import { computeG1ToGxConversion } from '../utils/g1gx';

const router = express.Router();

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
