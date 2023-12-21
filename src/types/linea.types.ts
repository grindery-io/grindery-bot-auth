/**
 * Represents the response structure expected for getting token price information.
 */
export type GetTokenPriceResponseType = {
  /**
   * Identifier for the response.
   */
  id: number;

  /**
   * JSON-RPC protocol version.
   */
  jsonrpc: string;

  /**
   * Result object containing blockchain, contract address, and USD price details.
   */
  result: {
    /**
     * Name of the blockchain.
     */
    blockchain: string;

    /**
     * Address of the smart contract.
     */
    contractAddress: string;

    /**
     * Price of the token in USD.
     */
    usdPrice: string;
  };
};

/**
 * Represents a summary of swap details indexed by token addresses.
 */
export interface SwapSummary {
  /**
   * Token address as key mapping to an object containing decimals.
   */
  [tokenAddress: string]: {
    /**
     * Number of decimals for the token.
     */
    decimals: number;
  };
}
