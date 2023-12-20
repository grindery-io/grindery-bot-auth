import { SOURCE_WALLET_ADDRESS } from '../../secrets';

/**
 * Collection name for storing transfers.
 */
export const WITHDRAW_WHITELIST_COLLECTION = 'withdraws-whitelist';

/**
 * Collection name for storing transfers.
 */
export const TRANSFERS_COLLECTION = 'transfers';

/**
 * Collection name for storing vestings.
 */
export const VESTING_COLLECTION = 'vestings';

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
 * BigQuery Table ID for storing users.
 */
export const USERS_TABLE_ID = 'users';

/**
 * BigQuery Table ID for storing transfers.
 */
export const TRANSFERS_TABLE_ID = 'transfer';

/**
 * BigQuery Table ID for storing wallet users.
 */
export const WALLET_USERS_TABLE_ID = 'wallet_users';

/**
 * Different transaction statuses.
 */
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILURE: 'failure',
  PENDING_HASH: 'pending_hash',
} as const;

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

/**
 * Start date for the IDO.
 */
export const IDO_START_DATE = new Date(Date.UTC(2024, 0, 1));

/**
 * Length of time to lock the tokens (in seconds).
 */
export const TOKEN_LOCK_TERM = 31536000;

/**
 * Default vesting admin address for Hedgey vesting locks.
 */
export const GRINDERY_VESTING_ADMIN = SOURCE_WALLET_ADDRESS; // REQUIRED, multisig wallet is recommended

// HEDGEY - DO NOT CHANGE THESE //

/**
 * Contract address for Hedgey Batch Planner.
 */
export const HEDGEY_BATCHPLANNER_ADDRESS =
  '0x3466EB008EDD8d5052446293D1a7D212cb65C646';

/**
 * Hedgey Locker contract for Vesting.
 */
export const HEDGEY_VESTING_LOCKER =
  '0x2CDE9919e81b20B4B33DD562a48a84b54C48F00C';

/**
 * Hedgey Locker contract for Lockups.
 */
export const HEDGEY_LOCKUP_LOCKER =
  '0x1961A23409CA59EEDCA6a99c97E4087DaD752486';
