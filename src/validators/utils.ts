import { validationResult } from 'express-validator';
import { Request } from 'express-validator/src/base';

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
