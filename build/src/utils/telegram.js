"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTelegramMessage = exports.getUser = void 0;
const tslib_1 = require("tslib");
const telegram_1 = require("telegram");
const index_1 = require("telegram/sessions/index");
const telegramClient_1 = tslib_1.__importDefault(require("./telegramClient"));
const crypt_1 = require("./crypt");
/**
 * @summary Gets user object from authorization header
 * @param {object} req - request object
 * @returns {object} User object
 */
const getUser = (req) => {
    const authorization = req.headers['authorization'];
    const token = authorization.split(' ')[1];
    const data = Object.fromEntries(new URLSearchParams(token));
    const user = JSON.parse((data.user || {}));
    return user;
};
exports.getUser = getUser;
/**
 * @summary Sends Telegram message on behalf of the user
 * @param {string} message - message to be sent
 * @param {string} recipientId  - recipient telegram user id
 * @param {any} senderUser - sender user object
 * @returns {Promise<any> } Promise object with a boolean `success` property, and a result `message` string
 */
const sendTelegramMessage = async (message, recipientId, senderUser) => {
    try {
        if (!message)
            throw new Error('Message is required');
        if (!recipientId)
            throw new Error('Recipient ID is required');
        if (!senderUser.userHandle)
            throw new Error('Sender username not found');
        if (!senderUser.telegramSession)
            throw new Error('Telegram session not found');
        const client = (0, telegramClient_1.default)(new index_1.StringSession((0, crypt_1.decrypt)(senderUser.telegramSession)));
        await client.connect();
        if (!client.connected) {
            throw new Error('Telegram client not connected');
        }
        // get recipient handle
        const recipient = await client.invoke(new telegram_1.Api.users.GetFullUser({
            id: recipientId,
        }));
        const recipientHandle = (recipient &&
            recipient.users &&
            recipient.users[0] &&
            recipient.users[0].username) ||
            '';
        const data = {
            peer: recipientHandle,
            message: message,
        };
        const result = await client.invoke(new telegram_1.Api.messages.SendMessage(data));
        if (result) {
            return { success: true, message: 'Message sent successfully' };
        }
        else {
            return { success: false, message: 'Message sending failed' };
        }
    }
    catch (error) {
        return { success: false, message: error.message };
    }
};
exports.sendTelegramMessage = sendTelegramMessage;
//# sourceMappingURL=telegram.js.map