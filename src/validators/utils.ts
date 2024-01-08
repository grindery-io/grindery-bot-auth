import { ValidationChain, validationResult } from 'express-validator';
import { Request } from 'express-validator/src/base';
import { body } from 'express-validator';
import { CHAIN_MAPPING } from '../utils/chains';

/**
 * This function validates the result of a request and returns an array of errors if any are found.
 * @param req - req stands for request and it is an object that contains information about the HTTP
 * request that was made by the client. It includes information such as the request method, URL,
 * headers, and any data that was sent in the request body. In this code snippet, the req parameter is
 * used to validate the
 * @param res - `res` is the response object that is sent back to the client by the server. It contains
 * information such as the status code, headers, and the response body. In this specific code snippet,
 * `res` is not used directly, but it is likely being passed in as a parameter to a
 * @returns If there are validation errors in the `req` object, an array of error objects will be
 * returned. Otherwise, an empty array will be returned.
 */
export const validateResult = (req: Request) => {
  const errors = validationResult(req);
  return errors.isEmpty() ? [] : errors.array();
};

/**
 * Validates whether a given field represents a 64-bit little-endian number encoded as a string.
 *
 * https://core.telegram.org/type/long
 *
 * @param {string} fieldName - The name of the field to be validated.
 * @param {boolean} isOptional - Indicates whether the field is optional for validation.
 * @returns {ValidationChain} - A validation chain object to validate the `fieldName`.
 *
 * @example
 * validateUserTelegramID('params.userTelegramID', false);
 */
export const validateUserTelegramID = (
  fieldName: string,
  isOptional: boolean,
): ValidationChain => {
  // Creates a validation chain for the specified `fieldName`
  const validationChain = body(fieldName).custom((value) => {
    // Checks if the value is not a string or doesn't match the pattern of a 64-bit little-endian number encoded as a string
    if (typeof value !== 'string' || !/^[0-9a-fA-F]+$/.test(value)) {
      throw new Error(
        `${fieldName} must be a string representing a 64-bit little-endian number`,
      );
    }
    // Returns true if the validation succeeds
    return true;
  });

  // Returns a validation chain that is optional or regular based on the `isOptional` flag
  return isOptional ? validationChain.optional() : validationChain;
};

/**
 * Validates whether the provided chain ID adheres to the EIP155 standard and is listed in our chain mapping.
 *
 * @param {string} fieldName - The name of the field to be validated.
 * @param {boolean} isOptional - Indicates whether the field is optional for validation.
 * @returns {ValidationChain} - A validation chain object to validate the `fieldName`.
 *
 * @example
 * validateChainID('params.chainId', false);
 */
export const validateChainID = (
  fieldName: string,
  isOptional: boolean,
): ValidationChain => {
  const validationChain = body(fieldName).custom((value) => {
    if (typeof value !== 'string' || !CHAIN_MAPPING[value]) {
      throw new Error(
        `${fieldName} must be a valid and supported EIP155 chain ID`,
      );
    }
    return true;
  });

  return isOptional ? validationChain.optional() : validationChain;
};
