"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const express_1 = require("express");
const bot_auth_1 = tslib_1.__importDefault(require("./routes/bot_auth"));
const notifications_1 = tslib_1.__importDefault(require("./routes/notifications"));
const bot_data_1 = tslib_1.__importDefault(require("./routes/bot_data"));
const webhook_1 = tslib_1.__importDefault(require("./routes/webhook"));
const telegram_1 = tslib_1.__importDefault(require("./routes/telegram"));
const db_1 = tslib_1.__importDefault(require("./routes/db"));
const support_1 = tslib_1.__importDefault(require("./routes/support"));
const leaderboard_1 = tslib_1.__importDefault(require("./routes/leaderboard"));
const analytics_1 = tslib_1.__importDefault(require("./routes/analytics"));
const users_1 = tslib_1.__importDefault(require("./routes/users"));
const router = (0, express_1.Router)();
router.use('/bot-auth', bot_auth_1.default);
router.use('/notifications', notifications_1.default);
router.use('/data', bot_data_1.default);
router.use('/webhook', webhook_1.default);
router.use('/telegram', telegram_1.default);
router.use('/db', db_1.default);
router.use('/support', support_1.default);
router.use('/leaderboard', leaderboard_1.default);
router.use('/analytics', analytics_1.default);
router.use('/users', users_1.default);
exports.default = router;
//# sourceMappingURL=router.js.map