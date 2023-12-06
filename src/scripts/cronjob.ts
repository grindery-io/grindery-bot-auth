import cron from 'node-cron';
import {
  importUsersLast4Hours,
  importTransfersLast4Hours,
  importOrUpdateWalletUsersLast2Hours,
} from './bigquery';
import { distributeReferralRewards, distributeSignupRewards } from './rewards';

// Schedule a task to run every hour
cron.schedule('0 * * * *', async () => {
  console.log('CRON - importUsersLast4Hours task');
  try {
    await importUsersLast4Hours();
  } catch (error) {
    console.log('CRON - importUsersLast4Hours error ', error);
  }
});

// Schedule a task to run every hour
cron.schedule('0 * * * *', async () => {
  console.log('CRON - importTransfersLast4Hours task');
  try {
    await importTransfersLast4Hours();
  } catch (error) {
    console.log('CRON - importTransfersLast4Hours error ', error);
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
