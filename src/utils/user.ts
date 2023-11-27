import { Database } from '../db/conn';
import { REWARDS_COLLECTION, USERS_COLLECTION } from './constants';
import { getPatchWalletAddressFromTgId } from './patchwallet';
import { addIdentitySegment } from './segment';

/**
 * Creates a new UserTelegram instance and initializes it.
 * @param {string} telegramID - The Telegram user ID.
 * @param {string} responsePath - The response path.
 * @param {string} userHandle - The user's handle.
 * @param {string} userName - The user's name.
 * @returns {Promise<UserTelegram>} - The initialized UserTelegram instance.
 */
export async function createUserTelegram(
  telegramID: string,
  responsePath: string,
  userHandle: string,
  userName: string,
): Promise<UserTelegram> {
  const user = new UserTelegram(telegramID, responsePath, userHandle, userName);
  await user.initializeUserDatabase();
  return user;
}

/**
 * Represents a UserTelegram.
 */
export class UserTelegram {
  telegramID: string;
  responsePath: string;
  patchwallet?: any;
  userHandle: string;
  userName: string;
  isInDatabase: boolean = false;
  db?: any;

  constructor(telegramID, responsePath, userHandle, userName) {
    this.telegramID = telegramID;
    this.responsePath = responsePath;
    this.patchwallet = undefined;
    this.userHandle = userHandle;
    this.userName = userName;
    this.isInDatabase = false;
  }

  /**
   * Initializes the UserTelegram's database connection and retrieves user data if available.
   */
  async initializeUserDatabase(): Promise<any> {
    this.db = await Database.getInstance();
    const userDB = await this.getUserFromDatabase();

    if (userDB) {
      this.isInDatabase = true;
      this.patchwallet = (userDB as any).patchwallet;
    } else {
      try {
        this.patchwallet = await getPatchWalletAddressFromTgId(this.telegramID);
      } catch (error) {
        console.error('Error:', error);
      }
    }
  }

  /**
   * Retrieves user data from the database.
   * @returns {Promise<Object>} - The user data from the database.
   */
  async getUserFromDatabase(): Promise<object> {
    return await this.db
      .collection(USERS_COLLECTION)
      .findOne({ userTelegramID: this.telegramID });
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
   * @returns {Promise<Object|undefined>} - The result of the database operation or `undefined` if the user is already in the database.
   */
  async saveToDatabase(eventId: string): Promise<object | undefined> {
    if (this.isInDatabase) return undefined;

    const user = await this.db.collection(USERS_COLLECTION).updateOne(
      { userTelegramID: this.telegramID },
      {
        $set: {
          userTelegramID: this.telegramID,
          userHandle: this.userHandle,
          userName: this.userName,
          responsePath: this.responsePath,
          patchwallet: this.patchwallet,
          dateAdded: new Date(),
        },
      },
      { upsert: true },
    );

    console.log(`[${eventId}] ${this.telegramID} added to the user database.`);

    return user;
  }

  /**
   * Saves user data to a segmentation system.
   * @param {string} eventId - The event identifier.
   * @returns {Promise<Object|undefined>} - The result of the operation or `undefined` if the user is already in the database.
   */
  async saveToSegment(eventId: string): Promise<object | undefined> {
    if (this.isInDatabase) return undefined;

    try {
      const identitySegment = await addIdentitySegment({
        userTelegramID: this.telegramID,
        responsePath: this.responsePath,
        userHandle: this.userHandle,
        userName: this.userName,
        patchwallet: this.patchwallet,
        dateAdded: new Date(),
      });

      console.log(`[${eventId}] ${this.telegramID} added to Segment.`);

      return identitySegment;
    } catch (error) {
      console.error(
        `[${eventId}] Error processing new user in Segment: ${error}`,
      );
    }

    return undefined;
  }

  /**
   * Retrieves the sign-up rewards for the user.
   * @returns {Promise<Array>} - An array of sign-up rewards.
   */
  async getSignUpReward(): Promise<Array<any>> {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: this.telegramID, reason: 'user_sign_up' })
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
  async getReferralRewards(): Promise<Array<any>> {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: this.telegramID, reason: '2x_reward' })
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
  async getLinkRewards(): Promise<Array<any>> {
    return await this.db
      .collection(REWARDS_COLLECTION)
      .find({ userTelegramID: this.telegramID, reason: 'referral_link' })
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
