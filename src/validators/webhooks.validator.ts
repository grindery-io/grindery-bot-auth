import { body } from 'express-validator';
import Web3 from 'web3';
import { CHAIN_MAPPING } from '../utils/chains';
import { validateChainID, validateUserTelegramID } from './utils';

/**
 * Validates parameters for a new reward event.
 */
export const newRewardValidator = [
  // Ensures the event is 'new_reward'
  body('event').equals('new_reward').withMessage('Invalid event type'),

  // Validates if params is an object
  body('params').isObject().withMessage('Params must be an object'),

  // Validates userTelegramID as a string
  validateUserTelegramID('params.userTelegramID', false),

  // Validates referentUserTelegramID as an optional string
  validateUserTelegramID('params.referentUserTelegramID', true),

  // Validates responsePath as a string
  body('params.responsePath')
    .isString()
    .withMessage('responsePath must be a string'),

  // Validates userHandle as a string
  body('params.userHandle')
    .isString()
    .withMessage('userHandle must be a string'),

  // Validates userName as a string
  body('params.userName').isString().withMessage('userName must be a string'),

  // Validates isSignupReward as an optional boolean
  body('params.isSignupReward')
    .optional()
    .isBoolean()
    .withMessage('isSignupReward must be a boolean'),

  // Validates isReferralReward as an optional boolean
  body('params.isReferralReward')
    .optional()
    .isBoolean()
    .withMessage('isReferralReward must be a boolean'),

  // Validates isLinkReward as an optional boolean
  body('params.isLinkReward')
    .optional()
    .isBoolean()
    .withMessage('isLinkReward must be a boolean'),

  // Validates delegatecall as an optional string in the set ['0', '1']
  body('params.delegatecall')
    .optional()
    .isIn([0, 1])
    .withMessage('delegatecall must be either 0 or 1'),

  // Validates tokenAddress as an optional valid address using Web3
  body('params.tokenAddress')
    .optional()
    .custom((value) => {
      if (!Web3.utils.isAddress(value)) {
        throw new Error('tokenAddress must be a valid address');
      }
      return true;
    }),

  // Validates chainName as an optional string
  body('params.chainName')
    .optional()
    .isString()
    .withMessage('chainName must be a string'),

  // Validates chainId as an optional string against a predefined mapping
  validateChainID('params.chainId', true),
];

/**
 * Validates parameters for a new transaction event.
 */
export const newTransactionValidator = [
  // Ensures the event is 'new_transaction'
  body('event').equals('new_transaction').withMessage('Invalid event type'),

  // Validates if params is an object
  body('params').isObject().withMessage('Params must be an object'),

  // Validates senderTgId as a string
  validateUserTelegramID('params.senderTgId', false),

  // Validates recipientTgId as a string
  validateUserTelegramID('params.recipientTgId', false),

  // Validates amount as a numeric string greater than 0
  body('params.amount').custom((value) => {
    const parsedAmount = parseFloat(value);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Invalid amount');
    }
    return true;
  }),

  // Validates delegatecall as an optional string in the set ['0', '1']
  body('params.delegatecall')
    .optional()
    .isIn([0, 1])
    .withMessage('delegatecall must be either 0 or 1'),

  // Validates tokenAddress as an optional valid address using Web3
  body('params.tokenAddress')
    .optional()
    .custom((value) => {
      if (!Web3.utils.isAddress(value)) {
        throw new Error('tokenAddress must be a valid address');
      }
      return true;
    }),

  // Validates chainName as an optional string
  body('params.chainName')
    .optional()
    .isString()
    .withMessage('chainName must be a string'),

  // Validates message as an optional string
  body('params.message')
    .optional()
    .isString()
    .withMessage('message must be a string'),

  // Validates tokenSymbol as an optional string
  body('params.tokenSymbol')
    .optional()
    .isString()
    .withMessage('tokenSymbol must be a string'),

  // Validates chainId as an optional string against a predefined mapping
  validateChainID('params.chainId', true),
];

/**
 * Validates parameters for a batch of new transaction events.
 */
export const newTransactionBatchValidator = [
  // Ensures the event is 'new_transaction_batch'
  body('event')
    .equals('new_transaction_batch')
    .withMessage('Invalid event type'),

  // Validates params as an array
  body('params').isArray().withMessage('Params must be an array'),

  // Validates each param within params as an object
  body('params.*').isObject().withMessage('Each param must be an object'),

  // Validates senderTgId within each param as a string
  validateUserTelegramID('params.*.senderTgId', false),

  // Validates recipientTgId within each param as a string
  body('params.*.recipientTgId').custom((value) => {
    if (typeof value !== 'string') {
      throw new Error('recipientTgId must be a string');
    }
    return true;
  }),

  // Validates amount within each param as a numeric string greater than 0
  body('params.*.amount').custom((value) => {
    const parsedAmount = parseFloat(value);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Invalid amount');
    }
    return true;
  }),

  // Validates delegatecall within each param as an optional number in the set [0, 1]
  body('params.*.delegatecall')
    .optional()
    .isIn([0, 1])
    .withMessage('delegatecall must be either 0 or 1'),

  // Validates tokenAddress within each param as an optional valid address using Web3
  body('params.*.tokenAddress')
    .optional()
    .custom((value) => {
      if (!Web3.utils.isAddress(value)) {
        throw new Error('tokenAddress must be a valid address');
      }
      return true;
    }),

  // Validates chainName within each param as an optional string
  body('params.*.chainName')
    .optional()
    .isString()
    .withMessage('chainName must be a string'),

  // Validates message within each param as an optional string
  body('params.*.message')
    .optional()
    .isString()
    .withMessage('message must be a string'),

  // Validates tokenSymbol within each param as an optional string
  body('params.*.tokenSymbol')
    .optional()
    .isString()
    .withMessage('tokenSymbol must be a string'),

  // Validates chainId within each param as an optional string against a predefined mapping
  body('params.*.chainId')
    .optional()
    .custom((value) => {
      if (!CHAIN_MAPPING[value]) {
        throw new Error('chainId must be a valid and supported chain ID');
      }
      return true;
    }),
];

/**
 * Validates parameters for a swap event.
 */
export const swapValidator = [
  // Validates the event as 'swap'
  body('event').equals('swap').withMessage('Invalid event type'),

  // Validates params as an object
  body('params').isObject().withMessage('Params must be an object'),

  // Validates value within params as a string
  body('params.value').isString().withMessage('value must be a string'),

  // Validates userTelegramID within params as a string
  // body('params.userTelegramID')
  //   .isString()
  //   .withMessage('userTelegramID must be a string'),

  // Validates userTelegramID within params as a string
  validateUserTelegramID('params.userTelegramID', false),

  // Validates to within params as an optional valid address
  body('params.to')
    .optional()
    .custom((value) => {
      if (!Web3.utils.isAddress(value)) {
        throw new Error('to must be a valid address');
      }
      return true;
    }),

  // Validates data within params as an optional string
  body('params.data')
    .optional()
    .isString()
    .withMessage('data must be a string'),

  // Validates tokenIn within params as a valid address
  body('params.tokenIn').custom((value) => {
    if (!Web3.utils.isAddress(value)) {
      throw new Error('tokenIn must be a valid address');
    }
    return true;
  }),

  // Validates amountIn within params as a numeric string greater than 0
  body('params.amountIn').custom((value) => {
    const parsedAmount = parseFloat(value);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Invalid amount');
    }
    return true;
  }),

  // Validates tokenOut within params as a valid address
  body('params.tokenOut').custom((value) => {
    if (!Web3.utils.isAddress(value)) {
      throw new Error('tokenOut must be a valid address');
    }
    return true;
  }),

  // Validates amountOut within params as a numeric string greater than 0
  body('params.amountOut').custom((value) => {
    const parsedAmount = parseFloat(value);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Invalid amount');
    }
    return true;
  }),

  // Validates priceImpact within params as a string
  body('params.priceImpact')
    .isString()
    .withMessage('priceImpact must be a string'),

  // Validates gas within params as a string
  body('params.gas').isString().withMessage('gas must be a string'),

  // Validates from within params as a valid address
  body('params.from')
    .optional()
    .custom((value) => {
      if (!Web3.utils.isAddress(value)) {
        throw new Error('from must be a valid address');
      }
      return true;
    }),

  // Validates tokenInSymbol within params as a string
  body('params.tokenInSymbol')
    .isString()
    .withMessage('tokenInSymbol must be a string'),

  // Validates tokenOutSymbol within params as a string
  body('params.tokenOutSymbol')
    .isString()
    .withMessage('tokenOutSymbol must be a string'),

  // Validates chainId as an optional string against a predefined mapping
  validateChainID('params.chainId', true),

  // Validates chainIn  as an optional string against a predefined mapping
  validateChainID('params.chainIn', true),

  // Validates chainOut  as an optional string against a predefined mapping
  validateChainID('params.chainOut', true),

  // Validates chainName within params as an optional string
  body('params.chainName')
    .optional()
    .isString()
    .withMessage('chainName must be a string'),

  // Validates amount within params as an optional numeric string greater than 0
  body('params.amount')
    .optional()
    .custom((value) => {
      const parsedAmount = parseFloat(value);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        throw new Error('Invalid amount');
      }
      return true;
    }),

  // Validates senderTgId within params as an optional string
  validateUserTelegramID('params.senderTgId', true),

  // Validates delegatecall within params as an optional number in the set [0, 1]
  body('params.delegatecall')
    .optional()
    .isIn([0, 1])
    .withMessage('delegatecall must be either 0 or 1'),
];

/**
 * Validates parameters for an isolated reward event.
 */
export const isolatedRewardValidator = [
  // Validates the event as 'isolated_reward'
  body('event').equals('isolated_reward').withMessage('Invalid event type'),

  // Validates params as an object
  body('params').isObject().withMessage('Params must be an object'),

  // Validates userTelegramID within params as a string
  validateUserTelegramID('params.userTelegramID', false),

  // Validates responsePath within params as an optional string
  body('params.responsePath')
    .optional()
    .isString()
    .withMessage('responsePath must be a string'),

  // Validates userHandle within params as an optional string
  body('params.userHandle')
    .optional()
    .isString()
    .withMessage('userHandle must be a string'),

  // Validates userName within params as an optional string
  body('params.userName')
    .optional()
    .isString()
    .withMessage('userName must be a string'),

  // Validates patchwallet within params as a valid address
  body('params.patchwallet').custom((value) => {
    if (!Web3.utils.isAddress(value)) {
      throw new Error('patchwallet must be a valid address');
    }
    return true;
  }),

  // Validates reason within params as a string
  body('params.reason').isString().withMessage('reason must be a string'),

  // Validates message within params as an optional string
  body('params.message')
    .optional()
    .isString()
    .withMessage('message must be a string'),

  // Validates amount within params as a numeric string greater than 0
  body('params.amount').custom((value) => {
    const parsedAmount = parseFloat(value);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Invalid amount');
    }
    return true;
  }),
  // Validates tokenAddress within params as an optional valid address
  body('params.tokenAddress')
    .optional()
    .custom((value) => {
      if (!Web3.utils.isAddress(value)) {
        throw new Error('tokenAddress must be a valid address');
      }
      return true;
    }),

  // Validates chainName within params as an optional string
  body('params.chainName')
    .optional()
    .isString()
    .withMessage('chainName must be a string'),

  // Validates referentUserTelegramID within params as an optional string
  validateUserTelegramID('params.referentUserTelegramID', false),

  // Validates isSignupReward within params as an optional boolean
  body('params.isSignupReward')
    .optional()
    .isBoolean()
    .withMessage('isSignupReward must be a boolean'),

  // Validates isReferralReward within params as an optional boolean
  body('params.isReferralReward')
    .optional()
    .isBoolean()
    .withMessage('isReferralReward must be a boolean'),

  // Validates isLinkReward within params as an optional boolean
  body('params.isLinkReward')
    .optional()
    .isBoolean()
    .withMessage('isLinkReward must be a boolean'),

  // Validates delegatecall within params as an optional number in the set [0, 1]
  body('params.delegatecall')
    .optional()
    .isIn([0, 1])
    .withMessage('delegatecall must be either 0 or 1'),

  // Validates chainId as an optional string against a predefined mapping
  validateChainID('params.chainId', true),
];

/**
 * Object containing validators for various events.
 * @property {Array} new_reward - Validator for the 'new_reward' event.
 * @property {Array} new_transaction - Validator for the 'new_transaction' event.
 * @property {Array} new_transaction_batch - Validator for the 'new_transaction_batch' event.
 * @property {Array} swap - Validator for the 'swap' event.
 * @property {Array} isolated_reward - Validator for the 'isolated_reward' event.
 */
const validators = {
  new_reward: newRewardValidator,
  new_transaction: newTransactionValidator,
  new_transaction_batch: newTransactionBatchValidator,
  swap: swapValidator,
  isolated_reward: isolatedRewardValidator,
};

/**
 * Validates incoming webhook events based on event type using corresponding validators.
 *
 * @param {Express.Request} req - The Express request object.
 * @param {Express.Response} res - The Express response object.
 * @param {Function} next - The next function in the middleware chain.
 * @returns {Promise<void>} - Promise resolving to void after validation or sending error responses.
 */
export const webhookValidator = async (req, res, next) => {
  const { event } = req.body;
  const validator = validators[event];

  // If validator for the specified event is not found, returns a 400 error response
  if (!validator) {
    return res
      .status(400)
      .json({ error: `Validator for event '${event}' not found` });
  }

  try {
    const errors: unknown[] = [];
    for (const validation of validator) {
      await validation(req, res, (error) => {
        if (error) {
          errors.push(error); // Collecting errors
        }
      });
    }

    // If there are validation errors, sends a 400 error response with collected errors
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    next(); // Proceeds to the next middleware in the chain if validation succeeds
  } catch (error) {
    // Catches any unexpected errors and sends a 400 error response
    return res.status(400).json({ error: error.message });
  }
};
