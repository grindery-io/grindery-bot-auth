import { Router } from 'express';
import bot_auth from './routes/bot_auth.js';
import notifications from './routes/notifications.js';
import data from './routes/bot_data.js';
import db from './routes/db.js';
import support from './routes/support.js';
import webhook from './routes/webhook.js';
import bigquery from './routes/big_query.js';
import users from './routes/users.js';

const router = Router();

router.use('/bot-auth', bot_auth);
router.use('/notifications', notifications);
router.use('/data', data);
router.use('/db', db);
router.use('/support', support);
router.use('/webhook', webhook);
router.use('/big-query', bigquery);
router.use('/users', users);

export default router;
