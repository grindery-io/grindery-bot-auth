export type HedgeyRecipientParams = {
  /** The address of the recipient. */
  recipient: string;
  /** The amount of tokens. */
  amount: string;
};

export type HedgeyPlanParams = {
  /** The address of the recipient. */
  recipient: string;
  /** The amount of tokens. */
  amount: string;
  /** The start date. */
  start: number;
  /** The cliff date. */
  cliff: number;
  /** The rate of distribution. */
  rate: number;
};
