import { ObjectId } from 'mongodb';

/**
 * Represents an Incoming Transaction from the database.
 */
export type IncomingTransaction = {
  /**
   * The date when the transaction was added.
   */
  dateAdded: string;

  /**
   * The handle of the sender user associated with the transaction.
   */
  senderUserHandle: string | null;

  /**
   * A message related to the transaction.
   */
  message: string;

  /**
   * The unique identifier of the transaction.
   */
  _id: ObjectId;

  /**
   * The amount of tokens associated with the transaction.
   */
  tokenAmount: string;
};

/**
 * Represents an Outgoing Transaction in the system.
 */
export type OutgoingTransaction = {
  /**
   * The unique identifier of the transaction.
   */
  _id: ObjectId;

  /**
   * The date when the transaction was added.
   */
  dateAdded: string;

  /**
   * The handle of the recipient user associated with the transaction, which can be a string or null.
   */
  recipientUserHandle: string | null;

  /**
   * The amount of tokens associated with the transaction.
   */
  tokenAmount: string;

  /**
   * The Telegram ID of the recipient user.
   */
  recipientTgId: string;

  /**
   * A message related to the transaction.
   */
  message: string;
};
