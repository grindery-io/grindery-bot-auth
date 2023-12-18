import cron from 'node-cron';
import { distributeReferralRewards, distributeSignupRewards } from './rewards';

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
