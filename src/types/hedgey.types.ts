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
  start: Number;
  /** The cliff date. */
  cliff: Number;
  /** The rate of distribution. */
  rate: Number;
};