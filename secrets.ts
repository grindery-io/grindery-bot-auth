import 'dotenv/config';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

// Instantiate the client
const client = new SecretManagerServiceClient();

/**
 * Retrieves a secret from Google Secret Manager.
 * @param {string} secretName - The name of the secret to retrieve.
 * @returns {Promise<string|null>} - The retrieved secret value or null in case of an error.
 */
async function getSecretVersion(secretName: string): Promise<string | null> {
  try {
    const [version] = await client.accessSecretVersion({
      name: secretName,
    });

    // Extract the secret's content
    const secretValue = version.payload.data.toString();
    return secretValue;
  } catch (err) {
    console.error(`Error retrieving the secret: ${err}`);
    return null; // Returns null in case of an error
  }
}

/**
 * Retrieves a secret from Google Secret Manager based on the provided secret name.
 * @param {string} secretName - The name of the secret to retrieve.
 * @returns {Promise<string>} - The retrieved secret value or an empty string if not found.
 */
async function getSecret(secretName: string): Promise<string | null> {
  if (process.env.NOT_GOOGLE_SECRET) return null;
  return await getSecretVersion(secretName);
}

/**
 * The port number used for the application.
 * Fallback: an empty string if not defined in the environment.
 */
export const PORT = process.env.PORT || '';

/**
 * The ANKR key.
 * Fallback: an empty string if not defined in the environment.
 */
export const ANKR_KEY = process.env.ANKR_KEY || '';

/**
 * The ALCHEMY API key.
 * Fallback: an empty string if not defined in the environment.
 */
export const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';

/**
 * The GETBLOCK API key.
 * Fallback: an empty string if not defined in the environment.
 */
export const GETBLOCK_API_KEY = process.env.GETBLOCK_API_KEY || '';

/**
 * The LAVANET API key.
 * Fallback: an empty string if not defined in the environment.
 */
export const LAVANET_API_KEY = process.env.LAVANET_API_KEY || '';

/**
 * The CHAINSTACK API key.
 * Fallback: an empty string if not defined in the environment.
 */
export const CHAINSTACK_API_KEY = process.env.CHAINSTACK_API_KEY || '';

/**
 * The second CHAINSTACK API key.
 * Fallback: an empty string if not defined in the environment.
 */
export const CHAINSTACK_API_KEY_2 = process.env.CHAINSTACK_API_KEY_2 || '';

/**
 * Retrieves the bot token.
 */
export async function getBotToken(): Promise<string> {
  return (
    (await getSecret(process.env.BOT_TOKEN_NAME)) || process.env.BOT_TOKEN || ''
  );
}

/**
 * Retrieves the client ID.
 */
export async function getClientId(): Promise<string> {
  return (
    (await getSecret(process.env.CLIENT_ID_NAME)) || process.env.CLIENT_ID || ''
  );
}

/**
 * Retrieves the client secret.
 */
export async function getClientSecret(): Promise<string> {
  return (
    (await getSecret(process.env.CLIENT_SECRET_NAME)) ||
    process.env.CLIENT_SECRET ||
    ''
  );
}

/**
 * Retrieves the API key.
 */
export async function getApiKey(): Promise<string> {
  return (
    (await getSecret(process.env.API_KEY_NAME)) || process.env.API_KEY || ''
  );
}

/**
 * Retrieves the API key for Linea.
 */
export const API_KEY_LINEA = process.env.API_KEY_LINEA || '';

/**
 * Retrieves the Atlas URI.
 */
export async function getAtlasUri(): Promise<string> {
  return (
    (await getSecret(process.env.ATLAS_URI_NAME)) || process.env.ATLAS_URI || ''
  );
}

/**
 * The G1 Polygon address used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const G1_POLYGON_ADDRESS = process.env.G1_POLYGON_ADDRESS || '';

/**
 * The source Telegram ID used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const SOURCE_TG_ID = process.env.SOURCE_TG_ID || '';

/**
 * The source wallet address used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const SOURCE_WALLET_ADDRESS = process.env.SOURCE_WALLET_ADDRESS || '';

/**
 * The Pub/Sub subscription name used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const PUBSUB_SUBSCRIPTION_NAME =
  process.env.PUBSUB_SUBSCRIPTION_NAME || '';

/**
 * The Pub/Sub topic name used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const PUBSUB_TOPIC_NAME = process.env.PUBSUB_TOPIC_NAME || '';

/**
 * The project ID used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const PROJECT_ID = process.env.PROJECT_ID || '';

/**
 * The FlowXO new user webhook.
 * Fallback: an empty string if not defined in the environment.
 */
export const FLOWXO_NEW_USER_WEBHOOK =
  process.env.FLOWXO_NEW_USER_WEBHOOK || '';

/**
 * The FlowXO new signup reward webhook.
 * Fallback: an empty string if not defined in the environment.
 */
export const FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK =
  process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK || '';

/**
 * The FlowXO new referral reward webhook.
 * Fallback: an empty string if not defined in the environment.
 */
export const FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK =
  process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK || '';

/**
 * The FlowXO new transaction webhook.
 * Fallback: an empty string if not defined in the environment.
 */
export const FLOWXO_NEW_TRANSACTION_WEBHOOK =
  process.env.FLOWXO_NEW_TRANSACTION_WEBHOOK || '';

/**
 * The FlowXO new vesting webhook.
 * Fallback: an empty string if not defined in the environment.
 */
export const FLOWXO_NEW_VESTING_WEBHOOK =
  process.env.FLOWXO_NEW_VESTING_WEBHOOK || '';

/**
 * The FlowXO new link reward webhook.
 * Fallback: an empty string if not defined in the environment.
 */
export const FLOWXO_NEW_LINK_REWARD_WEBHOOK =
  process.env.FLOWXO_NEW_LINK_REWARD_WEBHOOK || '';

/**
 * The FlowXO new isolated reward webhook.
 * Fallback: an empty string if not defined in the environment.
 */
export const FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK =
  process.env.FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK || '';

/**
 * The FlowXO new swap webhook.
 * Fallback: an empty string if not defined in the environment.
 */
export const FLOWXO_NEW_SWAP_WEBHOOK =
  process.env.FLOWXO_NEW_SWAP_WEBHOOK || '';

/**
 * The Airtable base ID used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';

/**
 * The Airtable API key used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';

/**
 * The Segment write key used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY || '';

/**
 * The Segment key used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const SEGMENT_KEY = process.env.SEGMENT_KEY || '';

/**
 * The Grindery account refresh token used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const GRINDERY_ACCOUNT_REFRESH_TOKEN =
  process.env.GRINDERY_ACCOUNT_REFRESH_TOKEN || '';

/**
 * The Grindery account workspace key used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const GRINDERY_ACCOUNT_WORKSPACE_KEY =
  process.env.GRINDERY_ACCOUNT_WORKSPACE_KEY || '';

/**
 * The wallet notification webhook URL used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const WALLET_NOTIFICATION_WEBHOOK_URL =
  process.env.WALLET_NOTIFICATION_WEBHOOK_URL || '';

/**
 * The Pub/Sub minimum acknowledgment deadline used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const PUBSUB_MIN_ACK_DEADLINE =
  process.env.PUBSUB_MIN_ACK_DEADLINE || '';

/**
 * The Pub/Sub maximum acknowledgment deadline used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const PUBSUB_MAX_ACK_DEADLINE =
  process.env.PUBSUB_MAX_ACK_DEADLINE || '';

/**
 * The Pub/Sub concurrency value used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const PUBSUB_CONCURRENCY = process.env.PUBSUB_CONCURRENCY || '';

/**
 * The Telegram API ID used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const TELEGRAM_API_ID = process.env.TELEGRAM_API_ID || '';

/**
 * The Telegram API hash used for something.
 * Fallback: an empty string if not defined in the environment.
 */
export const TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || '';

/**
 * The production environement.
 * Fallback: an empty string if not defined in the environment.
 */
export const PRODUCTION_ENV = process.env.PRODUCTION_ENV || '';

/**
 * Grindery Nexus refresh token.
 * Fallback: an empty string if not defined in the environment.
 */
export const GRINDERY_NEXUS_REFRESH_TOKEN =
  process.env.GRINDERY_NEXUS_REFRESH_TOKEN || '';
