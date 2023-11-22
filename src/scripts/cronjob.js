import cron from 'node-cron';
import {
  importUsersLast24Hours,
  importTransfersLast24Hours,
} from '../scripts/bigquery.js';

// Schedule a task to run every hour
cron.schedule('0 * * * *', async () => {
  console.log('CRON - importUsersLast24Hours task');
  await importUsersLast24Hours();
});

// Schedule a task to run every hour
cron.schedule('0 * * * *', async () => {
  console.log('CRON - importTransfersLast24Hours task');
  await importTransfersLast24Hours();
});
