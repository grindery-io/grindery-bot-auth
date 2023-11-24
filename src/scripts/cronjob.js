import cron from 'node-cron';
import {
  importUsersLast24Hours,
  importTransfersLast24Hours,
} from '../scripts/bigquery.js';

// Schedule a task to run every hour
cron.schedule('0 * * * *', async () => {
  console.log('CRON - importUsersLast24Hours task');
  try {
    await importUsersLast24Hours();
  } catch(error) {
    console.log('CRON - importUsersLast24Hours error ', error);
  }
});

// Schedule a task to run every hour
cron.schedule('0 * * * *', async () => {
  try {
    await importTransfersLast24Hours();
  } catch(error) {
    console.log('CRON - importTransfersLast24Hours error ', error);
  }
});
