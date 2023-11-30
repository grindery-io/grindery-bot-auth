import { createUserTelegram } from '../user';
import { signup_utils } from './signup-reward';
import { referral_utils } from './referral-reward';
import { link_reward_utils } from './link-reward';

/**
 * Handles the processing of a new reward based on the provided parameters.
 * @param params An object containing parameters necessary for handling the reward.
 * @param params.eventId The ID associated with the event triggering the reward.
 * @param params.userTelegramID The Telegram ID of the user receiving the reward.
 * @param params.responsePath The response path associated with the user.
 * @param params.userHandle The handle of the user receiving the reward.
 * @param params.userName The name of the user receiving the reward.
 * @param params.referentUserTelegramID Optional: The Telegram ID of the user who referred the current user.
 * @param params.tokenAddress Optional: The token address related to the reward.
 * @param params.chainName Optional: The chain name associated with the reward.
 * @param params.patchwallet Optional: The patch wallet address of the user.
 * @returns A Promise that resolves to a boolean indicating the success status of the reward handling process.
 */
export async function handleNewReward(params: {
  eventId: string;
  userTelegramID: string;
  responsePath: string;
  userHandle: string;
  userName: string;
  referentUserTelegramID?: string;
  tokenAddress?: string;
  chainName?: string;
  patchwallet?: string;
}): Promise<boolean> {
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
