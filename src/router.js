import { Router } from 'express';
import bot_auth from './routes/bot_auth.js';
import notifications from './routes/notifications.js';
import data from './routes/bot_data.js';
import webhook from './routes/webhook.js';
import telegram from './routes/telegram.js';
import db from './routes/db.js';
import support from './routes/support.js';
import leaderboard from './routes/leaderboard.js';
import analytics from './routes/analytics.js';
import users from './routes/users.js';

const router = Router();

router.use('/bot-auth', bot_auth);
router.use('/notifications', notifications);
router.use('/data', data);
router.use('/webhook', webhook);
router.use('/telegram', telegram);
router.use('/db', db);
router.use('/support', support);
router.use('/leaderboard', leaderboard);
router.use('/analytics', analytics);
router.use('/users', users);

export default router;
