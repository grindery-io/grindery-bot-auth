/**
 * Collection name for storing transfers.
 */
export const TRANSFERS_COLLECTION = 'transfers';

/**
 * Collection name for storing users.
 */
export const USERS_COLLECTION = 'users';

/**
 * Collection name for storing rewards.
 */
export const REWARDS_COLLECTION = 'rewards';

/**
 * Collection name for storing swaps.
 */
export const SWAPS_COLLECTION = 'swaps';

/**
 * Collection name for transfers in testing environment.
 */
export const TRANSFERS_TESTS_COLLECTION = 'transfers-test';

/**
 * Collection name for users in testing environment.
 */
export const USERS_TESTS_COLLECTION = 'users-test';

/**
 * Collection name for rewards in testing environment.
 */
export const REWARDS_TESTS_COLLECTION = 'rewards-test';

/**
 * Different transaction statuses.
 */
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILURE: 'failure',
  PENDING_HASH: 'pending_hash',
};

/**
 * Segment API endpoint.
 */
export const SEGMENT_API_ENDPOINT = 'https://api.segment.io/v1/batch';

/**
 * Native token addresses.
 */
export const nativeTokenAddresses = [
  '0x0',
  '0x0000000000000000000000000000000000000000',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
];
