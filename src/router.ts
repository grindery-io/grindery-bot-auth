import { Router } from 'express';
import bot_auth from './routes/bot_auth';
import data from './routes/bot_data';
import webhook from './routes/webhook';
import db from './routes/db';
import support from './routes/support';
import leaderboard from './routes/leaderboard';
import analytics from './routes/analytics';
import users from './routes/users';
import linea from './routes/linea';
import tge from './routes/tge';

const router = Router();

router.use('/bot-auth', bot_auth);
router.use('/data', data);
router.use('/webhook', webhook);
router.use('/db', db);
router.use('/support', support);
router.use('/leaderboard', leaderboard);
router.use('/analytics', analytics);
router.use('/users', users);
router.use('/linea', linea);
router.use('/tge', tge);

export default router;
