import { HedgeyRecipientParams } from './hedgey.types';
import { TransactionStatus } from './webhook.types';

/**
 * Represents a MongoDB document for Transfer transactions.
 */
export type MongoTransfer = {
  /** Unique event identifier */
  eventId: string;

  /** Chain identifier */
  chainId: string;

  /** Token symbol */
  tokenSymbol: string;

  /** Token address */
  tokenAddress: string;

  /** Telegram ID of the sender */
  senderTgId: string;

  /** Telegram ID of the recipient */
  recipientTgId: string;

  /** Amount of tokens transferred */
  tokenAmount: string;

  /** Status of the transaction */
  status: TransactionStatus;

  /** Date when the transfer was added */
  dateAdded: Date;

  /** Wallet address of the recipient */
  recipientWallet: string;

  /** Handle of the sender */
  senderHandle: string;

  /** Name of the sender */
  senderName: string;

  /** Wallet address of the sender */
  senderWallet: string;

  /** Transaction hash */
  transactionHash: string;

  /** User operation hash */
  userOpHash: string;

  /** Message linked to the transaction */
  message?: string;
};

/**
 * Represents a MongoDB document for Incoming Transfer transactions.
 */
export type MongoIncomingTransfer = MongoTransfer & {
  /** Date when the transfer was added - Represented as a string */
  dateAdded: string;

  /** Sender's user handle, if available. Can be null. */
  senderUserHandle: string | null;
};

/**
 * Represents a MongoDB document for Outgoing Transfer transactions.
 */
export type MongoOutgoingTransfer = MongoTransfer & {
  /** Date when the transfer was added - Represented as a string */
  dateAdded: string;

  /** Recipient's user handle, if available. Can be null. */
  recipientUserHandle?: string | null;
};

/**
 * Represents a MongoDB document for User details.
 */
export type MongoUser = {
  /** Telegram user ID */
  userTelegramID: string;

  /** Response path */
  responsePath: string;

  /** User handle */
  userHandle: string;

  /** User name */
  userName: string;

  /** Wallet address */
  patchwallet: string;

  /** Optional Telegram session */
  telegramSession?: string;
};

/**
 * Represents a MongoDB document for Reward transactions.
 */
export type MongoReward = {
  /** Telegram user ID */
  userTelegramID: string;

  /** Response path */
  responsePath: string;

  /** Wallet address */
  walletAddress: string;

  /** Reason for reward */
  reason: string;

  /** User handle */
  userHandle: string;

  /** User name */
  userName: string;

  /** Amount of the reward */
  amount: string;

  /** Message associated with the reward */
  message: string;

  /** Transaction hash */
  transactionHash: string;

  /** User operation hash */
  userOpHash: string;

  /** Date when the reward was added */
  dateAdded: Date;

  /** Status of the transaction */
  status: TransactionStatus;
};

/**
 * Represents a MongoDB document for Formatted Reward transactions.
 */
export type MongoRewardFmt = MongoReward & {
  /** Date when the reward was added - Represented as a string */
  dateAdded: string;

  /** Sponsored user's handle, if available. Can be null. */
  sponsoredUserHandle?: string | null;
};

/**
 * Represents a MongoDB document for Swap transactions.
 */
export type MongoSwap = {
  /** Unique event identifier */
  eventId: string;

  /** Chain identifier */
  chainId: string;

  /** Address of the recipient */
  to: string;

  /** Telegram user ID */
  userTelegramID: string;

  /** Token in */
  tokenIn: string;

  /** Amount of token in */
  amountIn: string;

  /** Token out */
  tokenOut: string;

  /** Amount of token out */
  amountOut: string;

  /** Price impact */
  priceImpact: string;

  /** Gas used */
  gas: string;

  /** Status of the transaction */
  status: TransactionStatus;

  /** Date when the swap was added */
  dateAdded: Date;

  /** Transaction hash */
  transactionHash: string;

  /** User operation hash */
  userOpHash: string;

  /** User handle */
  userHandle: string;

  /** User name */
  userName: string;

  /** User wallet */
  userWallet: string;
};

/**
 * Represents a MongoDB document for Vesting details.
 */
export type MongoVesting = {
  /** Unique event identifier */
  eventId: string;

  /** Chain identifier */
  chainId: string;

  /** Token symbol */
  tokenSymbol: string;

  /** Token address */
  tokenAddress: string;

  /** Telegram ID of the sender */
  senderTgId: string;

  /** Wallet address of the sender */
  senderWallet: string;

  /** Name of the sender */
  senderName: string;

  /** Handle of the sender */
  senderHandle: string;

  /** Recipients with Vesting details */
  recipients: HedgeyRecipientParams[];

  /** Status of the transaction */
  status: TransactionStatus;

  /** Date when the vesting was added */
  dateAdded: Date;

  /** Transaction hash */
  transactionHash: string;

  /** User operation hash */
  userOpHash: string;
};