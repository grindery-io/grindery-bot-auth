import { body } from 'express-validator';
import Web3 from 'web3';

export const withdrawValidator = [
  body('tgId').isString().withMessage('must be string value'),
  body('recipientwallet').custom((value, { req }) => {
    if (
      !Web3.utils.isAddress(value) ||
      !withdrawAddressMapping[req.body.tgId]?.includes(value)
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

const withdrawAddressMapping: Record<string, string[]> = {
  tgId1: ['0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5', '0xAnotherAddress'],
  tgId2: ['0xSomeAddress', '0xAnotherAddress'],
  // Add more tgIds
};
