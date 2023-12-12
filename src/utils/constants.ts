/**
 * Collection name for storing transfers.
 */
export const WITHDRAW_WHITELIST_COLLECTION = 'withdraws-whitelist';

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
 * Collection name for storing wallet users.
 */
export const WALLET_USERS_COLLECTION = 'wallet-users';

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
 * Collection name for wallet users in testing environment.
 */
export const WALLET_USERS_TESTS_COLLECTION = 'wallet-users-test';

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

/**
 * Default chain name used when none is provided.
 */
export const DEFAULT_CHAIN_NAME = 'matic';

/**
 * Default chain ID used when none is provided.
 */
export const DEFAULT_CHAIN_ID = 'eip155:137';

/**
 * Symbol for the G1 token.
 */
export const G1_TOKEN_SYMBOL = 'G1';

/**
 * Endpoint for identifying segments.
 */
export const SEGMENT_IDENTITY_URL = 'https://api.segment.io/v1/identify';

/**
 * Endpoint for tracking segments.
 */
export const SEGMENT_TRACK_URL = 'https://api.segment.io/v1/track';

/**
 * URL for the patch wallet resolver.
 */
export const PATCHWALLET_RESOLVER_URL = 'https://paymagicapi.com/v1/resolver';

/**
 * URL for the patch wallet authentication.
 */
export const PATCHWALLET_AUTH_URL = 'https://paymagicapi.com/v1/auth';

/**
 * URL for the patch wallet transaction.
 */
export const PATCHWALLET_TX_URL = 'https://paymagicapi.com/v1/kernel/tx';

/**
 * URL for the patch wallet transaction status.
 */
export const PATCHWALLET_TX_STATUS_URL =
  'https://paymagicapi.com/v1/kernel/txStatus';
