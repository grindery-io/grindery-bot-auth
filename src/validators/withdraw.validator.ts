import { body } from 'express-validator';
import Web3 from 'web3';
import { Database } from '../db/conn';
import { WITHDRAW_WHITELIST_COLLECTION } from '../utils/constants';

export const withdrawValidator = [
  body('tgId').isString().withMessage('must be string value'),
  body('recipientwallet').custom(async (value, { req }) => {
    const db = await Database.getInstance();
    const user = await db
      .collection(WITHDRAW_WHITELIST_COLLECTION)
      .findOne({ userTelegramID: req.body.tgId });

    if (
      !Web3.utils.isAddress(value) ||
      !user.withdrawAddresses?.includes(value)
    ) {
      throw new Error('Invalid recipient wallet');
    }
    return true;
  }),
  body('amount').custom((value) => {
    const parsedAmount = parseFloat(value);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Invalid amount');
    }
    return true;
  }),
  body('tokenAddress').custom((value) => {
    if (!Web3.utils.isAddress(value)) {
      throw new Error('Invalid tokenAddress');
    }
    return true;
  }),
];
