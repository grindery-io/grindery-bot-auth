import { Document, WithId } from 'mongodb';
import { DEFAULT_CHAIN_ID, G1_TOKEN_SYMBOL } from '../utils/constants';
import { G1_POLYGON_ADDRESS } from '../../secrets';

export type HedgeyRecipientParams = {
  /** The address of the recipient. */
  recipientAddress: string;
  /** The amount of tokens. */
  amount: string;
};

export type HedgeyPlanParams = [
  /** The address of the recipient. */
  string,
  /** The amount of tokens. */
  string,
  /** The start date. */
  number,
  /** The cliff date. */
  number,
  /** The rate of distribution. */
  string,
];

/**
 * Defines the structure for TransactionParams.
 */
export type VestingParams = {
  /** The Telegram user ID of the sender. */
  senderTgId: string;
  /** Recipients. */
  recipients: HedgeyRecipientParams[];
  /** The event ID associated with the transaction. */
  eventId: string;
  /** The chain ID for the transaction. */
  chainId?: string;
  /** The token address for the transaction. */
  tokenAddress?: string;
  /** The message associated with the transaction. */
  message?: string;
  /** The symbol of the token for the transaction. */
  tokenSymbol?: string;
  /** Additional sender information with MongoDB document ID. */
  senderInformation?: WithId<Document>;
};

/**
 * Creates a transaction by merging the provided parameters with default values.
 * @param params The parameters for the transaction.
 * @param senderInformation Additional sender information.
 * @returns A transaction with default values for missing parameters.
 */
export function createVesting(
  params: VestingParams,
  senderInformation: WithId<Document>,
): VestingParams {
  return {
    ...{
      tokenSymbol: G1_TOKEN_SYMBOL,
      tokenAddress: G1_POLYGON_ADDRESS,
      chainId: DEFAULT_CHAIN_ID,
    },
    ...params,
    senderInformation,
  };
}
