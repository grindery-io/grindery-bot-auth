import { Db, Document, WithId } from 'mongodb';
import { Database } from '../db/conn';
import { REWARDS_COLLECTION, USERS_COLLECTION } from './constants';
import { getPatchWalletAddressFromTgId } from './patchwallet';
import { addIdentitySegment } from './segment';
import { RewardParams } from '../types/webhook.types';

/**
 * Creates a new instance of UserTelegram and initializes its database.
 * @param params - The parameters used to create the UserTelegram instance.
 * @returns A Promise that resolves to the created UserTelegram instance.
 */
export async function createUserTelegram(
  params: RewardParams,
): Promise<UserTelegram> {
  const user = new UserTelegram(params);
  await user.initializeUserDatabase();
  return user;
}

/**
 * Represents a UserTelegram.
 */
export class UserTelegram {
  /**
   * The parameters used to create the UserTelegram instance.
   */
  params: RewardParams;

  /**
   * Indicates whether the user exists in the database.
   */
  isInDatabase: boolean = false;

  /**
   * The database instance associated with the user.
   */
  db?: Db;

  /**
   * Constructs a new UserTelegram instance.
   * @param params - The parameters used to create the UserTelegram instance.
   */
  constructor(params: RewardParams) {
    this.params = params;
    this.isInDatabase = false;
  }
  /**
   * Initializes the UserTelegram's database connection and retrieves user data if available.
   */
  async initializeUserDatabase(): Promise<void> {
    this.db = await Database.getInstance();
    const userDB = await this.getUserFromDatabase();

    if (userDB) {
      this.isInDatabase = true;
      this.params.patchwallet = userDB.patchwallet;
    } else {
      try {
        this.params.patchwallet = await getPatchWalletAddressFromTgId(
          this.params.userTelegramID,
        );
      } catch (error) {
        console.error('Error:', error);
      }
    }
  }

  /**
   * Retrieves user data from the database.
   * @returns {Promise<WithId<Document>>} - The user data from the database.
   */
  async getUserFromDatabase(): Promise<WithId<Document>> {
    return await this.db
      .collection(USERS_COLLECTION)
      .findOne({ userTelegramID: this.params.userTelegramID });
  }

  /**
   * Checks if the user is in the database.
   * @returns {Promise<boolean>} - `true` if the user is in the database, `false` otherwise.
   */
  async isUserInDatabase(): Promise<boolean> {
    this.isInDatabase = !!(await this.getUserFromDatabase());
    return this.isInDatabase;
  }

  /**
   * Saves user data to the database.
   * @param {string} eventId - The event identifier.
   * @returns {Promise<void>} - The result of the database operation or `undefined` if the user is already in the database.
   */
  async saveToDatabase(eventId: string): Promise<void> {
    if (this.isInDatabase) return;

    await this.db.collection(USERS_COLLECTION).updateOne(
      { userTelegramID: this.params.userTelegramID },
      {
        $set: {
          userTelegramID: this.params.userTelegramID,
          userHandle: this.params.userHandle,
          userName: this.params.userName,
          responsePath: this.params.responsePath,
          patchwallet: this.params.patchwallet,
          dateAdded: new Date(),
        },
      },
      { upsert: true },
    );

    console.log(
      `[${eventId}] ${this.params.userTelegramID} added to the user database.`,
    );
  }

  /**
   * Saves user data to a segmentation system.
   * @param {string} eventId - The event identifier.
   * @returns {Promise<void>} - The result of the operation or `undefined` if the user is already in the database.
   */
  async saveToSegment(eventId: string): Promise<void> {
    if (this.isInDatabase) return;

    try {
      await addIdentitySegment({
        ...this.params,
        dateAdded: new Date(),
      });

      console.log(
        `[${eventId}] ${this.params.userTelegramID} added to Segment.`,
      );
    } catch (error) {
      console.error(
        `[${eventId}] Error processing new user in Segment: ${error}`,
      );
    }
  }

  /**
   * Retrieves the sign-up rewards for the user.
   * @returns {Promise<Array>} - An array of sign-up rewards.
   */
  async getSignUpReward(): Promise<WithId<Document>[]> {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({
        userTelegramID: this.params.userTelegramID,
        reason: 'user_sign_up',
      })
      .toArray();
  }

  /**
   * Checks if the user has sign-up rewards.
   * @returns {Promise<boolean>} - `true` if the user has sign-up rewards, `false` otherwise.
   */
  async HasSignUpReward(): Promise<boolean> {
    return (await this.getSignUpReward()).length > 0;
  }

  /**
   * Retrieves referral rewards for the user.
   * @returns {Promise<Array>} - An array of referral rewards.
   */
  async getReferralRewards(): Promise<WithId<Document>[]> {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: this.params.userTelegramID, reason: '2x_reward' })
      .toArray();
  }

  /**
   * Retrieves the number of referral rewards for the user.
   * @returns {Promise<number>} - The number of referral rewards.
   */
  async getNbrReferralRewards(): Promise<number> {
    return (await this.getReferralRewards()).length;
  }

  /**
   * Retrieves link rewards for the user.
   * @returns {Promise<Array>} - An array of link rewards.
   */
  async getLinkRewards(): Promise<WithId<Document>[]> {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({
        userTelegramID: this.params.userTelegramID,
        reason: 'referral_link',
      })
      .toArray();
  }

  /**
   * Retrieves the number of link rewards for the user.
   * @returns {Promise<number>} - The number of link rewards.
   */
  async getNbrLinkRewards(): Promise<number> {
    return (await this.getLinkRewards()).length;
  }
}
