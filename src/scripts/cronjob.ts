import cron from 'node-cron';
import {
  importUsersLast24Hours,
  importTransfersLast24Hours,
  importOrUpdateWalletUsersLast2Hours,
} from './bigquery';
import { distributeReferralRewards, distributeSignupRewards } from './rewards';

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
  console.log('CRON - importTransfersLast24Hours task');
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

// Schedule a task to run every hour
cron.schedule('0 * * * *', async () => {
  console.log('CRON - importOrUpdateWalletUsersLast2Hours task');
  try {
    importOrUpdateWalletUsersLast2Hours();
  } catch (error) {
    console.log('CRON - importOrUpdateWalletUsersLast2Hours error ', error);
  }
});
