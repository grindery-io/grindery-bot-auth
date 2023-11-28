"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const node_cron_1 = tslib_1.__importDefault(require("node-cron"));
const bigquery_1 = require("./bigquery");
const rewards_1 = require("./rewards");
// Schedule a task to run every hour
node_cron_1.default.schedule('0 * * * *', async () => {
    console.log('CRON - importUsersLast24Hours task');
    try {
        await (0, bigquery_1.importUsersLast24Hours)();
    }
    catch (error) {
        console.log('CRON - importUsersLast24Hours error ', error);
    }
});
// Schedule a task to run every hour
node_cron_1.default.schedule('0 * * * *', async () => {
    try {
        await (0, bigquery_1.importTransfersLast24Hours)();
    }
    catch (error) {
        console.log('CRON - importTransfersLast24Hours error ', error);
    }
});
// Schedule a task at 00:00 on every day-of-month
node_cron_1.default.schedule('0 0 */1 * *', async () => {
    console.log('CRON - distributeSignupRewards task');
    try {
        (0, rewards_1.distributeSignupRewards)();
    }
    catch (error) {
        console.log('CRON - distributeSignupRewards error ', error);
    }
});
// Schedule a task at 00:00 on every day-of-month
node_cron_1.default.schedule('0 0 */1 * *', async () => {
    console.log('CRON - distributeReferralRewards task');
    try {
        (0, rewards_1.distributeReferralRewards)();
    }
    catch (error) {
        console.log('CRON - distributeReferralRewards error ', error);
    }
});
//# sourceMappingURL=cronjob.js.map