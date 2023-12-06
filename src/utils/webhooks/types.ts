import { Document, WithId } from 'mongodb';

/**
 * Defines the structure for SwapParams.
 */
export type SwapParams = {
  /** The value of the swap. */
  value: string;
  /** The event ID associated with the swap. */
  eventId: string;
  /** The Telegram user ID associated with the swap. */
  userTelegramID: string;
  /** Additional user information with MongoDB document ID. */
  userInformation?: WithId<Document>;
  /** The recipient wallet address. */
  to?: string;
  /** Additional data for the swap. */
  data?: string;
  /** The input token for the swap. */
  tokenIn: string;
  /** The amount of input tokens. */
  amountIn: string;
  /** The output token for the swap. */
  tokenOut: string;
  /** The amount of output tokens. */
  amountOut: string;
  /** The price impact of the swap. */
  priceImpact: string;
  /** The gas value for the swap. */
  gas: string;
  /** The sender's address for the swap. */
  from: string;
  /** The symbol of the input token. */
  tokenInSymbol: string;
  /** The symbol of the output token. */
  tokenOutSymbol: string;
  /** The chain ID for the swap. */
  chainId?: string;
  /** The chain name for the swap. */
  chainName?: string;
  /** Additional amount information for the swap. */
  amount?: string;
  /** The Telegram user ID of the sender. */
  senderTgId?: string;
};

/**
 * Defines the structure for RewardParams.
 */
export type RewardParams = {
  /** The event ID associated with the reward. */
  eventId: string;
  /** The Telegram user ID associated with the reward. */
  userTelegramID: string;
  /** The path for the response. */
  responsePath?: string;
  /** The handle of the user. */
  userHandle?: string;
  /** The name of the user. */
  userName?: string;
  /** The wallet patch information. */
  patchwallet?: string;
  /** The reason for the reward. */
  reason?: string;
  /** The message associated with the reward. */
  message?: string;
  /** The amount for the reward. */
  amount?: string;
  /** The token address for the reward. */
  tokenAddress?: string;
  /** The chain name for the reward. */
  chainName?: string;
  /** The Telegram user ID of the referent. */
  referentUserTelegramID?: string;
};

/**
 * Defines the structure for TransactionParams.
 */
export type TransactionParams = {
  /** The Telegram user ID of the sender. */
  senderTgId: string;
  /** The amount of the transaction. */
  amount: string;
  /** The Telegram user ID of the recipient. */
  recipientTgId: string;
  /** The event ID associated with the transaction. */
  eventId: string;
  /** The chain ID for the transaction. */
  chainId?: string;
  /** The token address for the transaction. */
  tokenAddress?: string;
  /** The chain name for the transaction. */
  chainName?: string;
  /** The message associated with the transaction. */
  message?: string;
  /** The symbol of the token for the transaction. */
  tokenSymbol?: string;
  /** Additional sender information with MongoDB document ID. */
  senderInformation?: WithId<Document>;
};
