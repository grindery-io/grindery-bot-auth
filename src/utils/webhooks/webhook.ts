import { createUserTelegram } from '../user';
import { signup_utils } from './signup-reward';
import { referral_utils } from './referral-reward';
import { link_reward_utils } from './link-reward';

/**
 * Handles the processing of a new reward for a user.
 *
 * @param {any} params - The parameters containing user and event details.
 * @returns {Promise<boolean>} - Returns true if the operation was successful, false otherwise.
 */
export async function handleNewReward(params: any): Promise<boolean> {
  const user = await createUserTelegram(
    params.userTelegramID,
    params.responsePath,
    params.userHandle,
    params.userName,
  );

  if (user.isInDatabase) {
    // The user already exists, stop processing
    console.log(`[${params.eventId}] ${user.telegramID} user already exists.`);
    return true;
  }

  if (!user.patchwallet) return false;

  if (
    !(await signup_utils.handleSignUpReward({
      ...params,
      patchwallet: user.patchwallet,
    }))
  )
    return false;

  if (
    !(await referral_utils.handleReferralReward({
      ...params,
      patchwallet: user.patchwallet,
    }))
  )
    return false;

  if (
    params.referentUserTelegramID &&
    !(await link_reward_utils.handleLinkReward(
      params.eventId,
      params.userTelegramID,
      params.referentUserTelegramID,
      params.tokenAddress,
      params.chainName,
    ))
  )
    return false;

  if (!(await user.isUserInDatabase())) {
    await user.saveToDatabase(params.eventId);
    await user.saveToSegment(params.eventId);
  }

  return true;
}
