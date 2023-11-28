"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const telegram_1 = require("telegram");
const secrets_1 = require("../../secrets");
const TGClient = (session) => {
    return new telegram_1.TelegramClient(session, Number(secrets_1.TELEGRAM_API_ID), secrets_1.TELEGRAM_API_HASH, {
        connectionRetries: 5,
    });
};
exports.default = TGClient;
//# sourceMappingURL=telegramClient.js.map