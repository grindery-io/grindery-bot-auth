import cron from 'node-cron';
import {
  importUsersLast24Hours,
  importTransfersLast24Hours,
} from '../scripts/bigquery.js';
import {
  distributeReferralRewards,
  distributeSignupRewards,
} from './rewards.js';

// Schedule a task to run every hour
cron.schedule('0 * * * *', async () => {
  console.log('CRON - importUsersLast24Hours task');
  try {
    await importUsersLast24Hours();
  } catch (error) {
    console.log('CRON - importUsersLast24Hours error ', error);
  }
});

// Schedule a task to run every hour
cron.schedule('0 * * * *', async () => {
  try {
    await importTransfersLast24Hours();
  } catch (error) {
    console.log('CRON - importTransfersLast24Hours error ', error);
  }
});

// Schedule a task at 00:00 on every day-of-month
cron.schedule('0 0 */1 * *', async () => {
  console.log('CRON - distributeSignupRewards task');
  try {
    distributeSignupRewards();
  } catch (error) {
    console.log('CRON - distributeSignupRewards error ', error);
  }
});

// Schedule a task at 00:00 on every day-of-month
cron.schedule('0 0 */1 * *', async () => {
  console.log('CRON - distributeReferralRewards task');
  try {
    distributeReferralRewards();
  } catch (error) {
    console.log('CRON - distributeReferralRewards error ', error);
  }
});
