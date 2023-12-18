import { createUserTelegram } from '../utils/user';
import { signup_utils } from './signup-reward';
import { referral_utils } from './referral-reward';
import { link_reward_utils } from './link-reward';
import { RewardParams, createRewardParams } from '../types/webhook.types';

/**
 * Handles the processing of a new reward event.
 * @param params - Parameters required for the new reward event.
 * @returns A boolean indicating successful processing of the reward event.
 */
export async function handleNewReward(params: RewardParams): Promise<boolean> {
  // Creates a new user based on the provided parameters.
  const user = await createUserTelegram(
    params.userTelegramID,
    params.responsePath,
    params.userHandle,
    params.userName,
  );

  // Checks if the user is already in the database.
  if (user.isInDatabase) {
    // Stops processing and logs that the user already exists.
    console.log(`[${params.eventId}] ${user.telegramID} user already exists.`);
    return true;
  }

  // Stops processing if user's patchwallet is missing.
  if (!user.patchwallet) return false;

  const param_rewards = createRewardParams(params, user.patchwallet);

  // Handles the sign-up reward for the user.
  if (
    params.isSignupReward &&
    !(await signup_utils.handleSignUpReward(param_rewards))
  )
    return false;

  // Handles the referral reward for the user.
  if (
    params.isReferralReward &&
    !(await referral_utils.handleReferralReward(param_rewards))
  )
    return false;

  // Handles the link reward for the user if a referent user Telegram ID is provided.
  if (
    params.isLinkReward &&
    params.referentUserTelegramID &&
    !(await link_reward_utils.handleLinkReward(param_rewards))
  )
    return false;

  // Saves the user to the database if not already present.
  if (!(await user.isUserInDatabase())) {
    await user.saveToDatabase(params.eventId);
    await user.saveToSegment(params.eventId);
  }

  // Indicates successful processing of the reward event.
  return true;
}
