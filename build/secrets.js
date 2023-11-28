"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEST_ENV = exports.TELEGRAM_API_HASH = exports.TELEGRAM_API_ID = exports.PUBSUB_CONCURRENCY = exports.PUBSUB_MAX_ACK_DEADLINE = exports.PUBSUB_MIN_ACK_DEADLINE = exports.WALLET_NOTIFICATION_WEBHOOK_URL = exports.GRINDERY_ACCOUNT_WORKSPACE_KEY = exports.GRINDERY_ACCOUNT_REFRESH_TOKEN = exports.SEGMENT_KEY = exports.SEGMENT_WRITE_KEY = exports.AIRTABLE_API_KEY = exports.AIRTABLE_BASE_ID = exports.FLOWXO_NEW_SWAP_WEBHOOK = exports.FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK = exports.FLOWXO_NEW_LINK_REWARD_WEBHOOK = exports.FLOWXO_NEW_TRANSACTION_WEBHOOK = exports.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK = exports.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK = exports.FLOWXO_NEW_USER_WEBHOOK = exports.PROJECT_ID = exports.PUBSUB_TOPIC_NAME = exports.PUBSUB_SUBSCRIPTION_NAME = exports.SOURCE_WALLET_ADDRESS = exports.SOURCE_TG_ID = exports.G1_POLYGON_ADDRESS = exports.getAtlasUri = exports.getApiKey = exports.getClientSecret = exports.getClientId = exports.getBotToken = exports.CHAINSTACK_API_KEY_2 = exports.CHAINSTACK_API_KEY = exports.LAVANET_API_KEY = exports.GETBLOCK_API_KEY = exports.ALCHEMY_API_KEY = exports.ANKR_KEY = exports.PORT = void 0;
require("dotenv/config");
const secret_manager_1 = require("@google-cloud/secret-manager");
// Instantiate the client
const client = new secret_manager_1.SecretManagerServiceClient();
/**
 * Retrieves a secret from Google Secret Manager.
 * @param {string} secretName - The name of the secret to retrieve.
 * @returns {Promise<string|null>} - The retrieved secret value or null in case of an error.
 */
async function getSecretVersion(secretName) {
    try {
        const [version] = await client.accessSecretVersion({
            name: secretName,
        });
        // Extract the secret's content
        const secretValue = version.payload.data.toString();
        return secretValue;
    }
    catch (err) {
        console.error(`Error retrieving the secret: ${err}`);
        return null; // Returns null in case of an error
    }
}
/**
 * Retrieves a secret from Google Secret Manager based on the provided secret name.
 * @param {string} secretName - The name of the secret to retrieve.
 * @returns {Promise<string>} - The retrieved secret value or an empty string if not found.
 */
async function getSecret(secretName) {
    if (process.env.NOT_GOOGLE_SECRET)
        return null;
    return await getSecretVersion(secretName);
}
/**
 * The port number used for the application.
 * Fallback: an empty string if not defined in the environment.
 */
exports.PORT = process.env.PORT || '';
/**
 * The ANKR key.
 * Fallback: an empty string if not defined in the environment.
 */
exports.ANKR_KEY = process.env.ANKR_KEY || '';
/**
 * The ALCHEMY API key.
 * Fallback: an empty string if not defined in the environment.
 */
exports.ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || '';
/**
 * The GETBLOCK API key.
 * Fallback: an empty string if not defined in the environment.
 */
exports.GETBLOCK_API_KEY = process.env.GETBLOCK_API_KEY || '';
/**
 * The LAVANET API key.
 * Fallback: an empty string if not defined in the environment.
 */
exports.LAVANET_API_KEY = process.env.LAVANET_API_KEY || '';
/**
 * The CHAINSTACK API key.
 * Fallback: an empty string if not defined in the environment.
 */
exports.CHAINSTACK_API_KEY = process.env.CHAINSTACK_API_KEY || '';
/**
 * The second CHAINSTACK API key.
 * Fallback: an empty string if not defined in the environment.
 */
exports.CHAINSTACK_API_KEY_2 = process.env.CHAINSTACK_API_KEY_2 || '';
/**
 * Retrieves the bot token.
 */
async function getBotToken() {
    return ((await getSecret(process.env.BOT_TOKEN_NAME)) || process.env.BOT_TOKEN || '');
}
exports.getBotToken = getBotToken;
/**
 * Retrieves the client ID.
 */
async function getClientId() {
    return ((await getSecret(process.env.CLIENT_ID_NAME)) || process.env.CLIENT_ID || '');
}
exports.getClientId = getClientId;
/**
 * Retrieves the client secret.
 */
async function getClientSecret() {
    return ((await getSecret(process.env.CLIENT_SECRET_NAME)) ||
        process.env.CLIENT_SECRET ||
        '');
}
exports.getClientSecret = getClientSecret;
/**
 * Retrieves the API key.
 */
async function getApiKey() {
    return ((await getSecret(process.env.API_KEY_NAME)) || process.env.API_KEY || '');
}
exports.getApiKey = getApiKey;
/**
 * Retrieves the Atlas URI.
 */
async function getAtlasUri() {
    return ((await getSecret(process.env.ATLAS_URI_NAME)) || process.env.ATLAS_URI || '');
}
exports.getAtlasUri = getAtlasUri;
/**
 * The G1 Polygon address used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.G1_POLYGON_ADDRESS = process.env.G1_POLYGON_ADDRESS || '';
/**
 * The source Telegram ID used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.SOURCE_TG_ID = process.env.SOURCE_TG_ID || '';
/**
 * The source wallet address used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.SOURCE_WALLET_ADDRESS = process.env.SOURCE_WALLET_ADDRESS || '';
/**
 * The Pub/Sub subscription name used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.PUBSUB_SUBSCRIPTION_NAME = process.env.PUBSUB_SUBSCRIPTION_NAME || '';
/**
 * The Pub/Sub topic name used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.PUBSUB_TOPIC_NAME = process.env.PUBSUB_TOPIC_NAME || '';
/**
 * The project ID used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.PROJECT_ID = process.env.PROJECT_ID || '';
/**
 * The FlowXO new user webhook.
 * Fallback: an empty string if not defined in the environment.
 */
exports.FLOWXO_NEW_USER_WEBHOOK = process.env.FLOWXO_NEW_USER_WEBHOOK || '';
/**
 * The FlowXO new signup reward webhook.
 * Fallback: an empty string if not defined in the environment.
 */
exports.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK = process.env.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK || '';
/**
 * The FlowXO new referral reward webhook.
 * Fallback: an empty string if not defined in the environment.
 */
exports.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK = process.env.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK || '';
/**
 * The FlowXO new transaction webhook.
 * Fallback: an empty string if not defined in the environment.
 */
exports.FLOWXO_NEW_TRANSACTION_WEBHOOK = process.env.FLOWXO_NEW_TRANSACTION_WEBHOOK || '';
/**
 * The FlowXO new link reward webhook.
 * Fallback: an empty string if not defined in the environment.
 */
exports.FLOWXO_NEW_LINK_REWARD_WEBHOOK = process.env.FLOWXO_NEW_LINK_REWARD_WEBHOOK || '';
/**
 * The FlowXO new isolated reward webhook.
 * Fallback: an empty string if not defined in the environment.
 */
exports.FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK = process.env.FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK || '';
/**
 * The FlowXO new swap webhook.
 * Fallback: an empty string if not defined in the environment.
 */
exports.FLOWXO_NEW_SWAP_WEBHOOK = process.env.FLOWXO_NEW_SWAP_WEBHOOK || '';
/**
 * The Airtable base ID used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
/**
 * The Airtable API key used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
/**
 * The Segment write key used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY || '';
/**
 * The Segment key used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.SEGMENT_KEY = process.env.SEGMENT_KEY || '';
/**
 * The Grindery account refresh token used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.GRINDERY_ACCOUNT_REFRESH_TOKEN = process.env.GRINDERY_ACCOUNT_REFRESH_TOKEN || '';
/**
 * The Grindery account workspace key used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.GRINDERY_ACCOUNT_WORKSPACE_KEY = process.env.GRINDERY_ACCOUNT_WORKSPACE_KEY || '';
/**
 * The wallet notification webhook URL used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.WALLET_NOTIFICATION_WEBHOOK_URL = process.env.WALLET_NOTIFICATION_WEBHOOK_URL || '';
/**
 * The Pub/Sub minimum acknowledgment deadline used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.PUBSUB_MIN_ACK_DEADLINE = process.env.PUBSUB_MIN_ACK_DEADLINE || '';
/**
 * The Pub/Sub maximum acknowledgment deadline used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.PUBSUB_MAX_ACK_DEADLINE = process.env.PUBSUB_MAX_ACK_DEADLINE || '';
/**
 * The Pub/Sub concurrency value used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.PUBSUB_CONCURRENCY = process.env.PUBSUB_CONCURRENCY || '';
/**
 * The Telegram API ID used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.TELEGRAM_API_ID = process.env.TELEGRAM_API_ID || '';
/**
 * The Telegram API hash used for something.
 * Fallback: an empty string if not defined in the environment.
 */
exports.TELEGRAM_API_HASH = process.env.TELEGRAM_API_HASH || '';
/**
 * The testing environement.
 * Fallback: an empty string if not defined in the environment.
 */
exports.TEST_ENV = process.env.TEST_ENV || '';
//# sourceMappingURL=secrets.js.map