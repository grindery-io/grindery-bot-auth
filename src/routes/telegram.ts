import express from 'express';
import { Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index';
import createTelegramPromise from '../utils/telegramPromise';
import { v4 as uuidv4 } from 'uuid';
import TGClient from '../utils/telegramClient';
import { isRequired } from '../utils/auth';
import bigInt from 'big-integer';

const router = express.Router();
const operations = {};

/**
 * POST /v1/telegram/init
 *
 * @summary Initialize a Telegram Session
 * @description Start a session with Telegram using phone number and password, awaiting a phone code for full authentication.
 * @tags Telegram
 * @param {object} request.body - The request body containing the phone and password.
 * @return {object} 200 - Success response with operation ID and status
 * @example request - 200 - Example request body
 * {
 *   "phone": "5511987876565",
 *   "password": "user_password"
 * }
 * @example response - 200 - Success response example
 * {
 *   "operationId": "some-uuid",
 *   "status": "pending"
 * }
 */
router.post('/init', isRequired, async (req, res) => {
  const operationId = uuidv4();

  const client = TGClient(new StringSession(''));
  operations[operationId] = {
    status: 'pending',
    client: client,
    phoneCodePromise: null,
  };
  const globalPhoneCodePromise = createTelegramPromise();
  operations[operationId].phoneCodePromise = globalPhoneCodePromise;

  client
    .start({
      phoneNumber: req.body.phone,
      password: async () => {
        return req.body.password;
      },
      phoneCode: async () => {
        if (operations[operationId].phoneCodePromise) {
          const code = await operations[operationId].phoneCodePromise.promise;
          operations[operationId].phoneCodePromise = createTelegramPromise();
          return code;
        }
        throw new Error('Phone code promise not found.');
      },
      onError: (err) => {
        operations[operationId].status = 'error';
        operations[operationId].error = err;
      },
    })
    .then(() => {
      operations[operationId].status = 'completed';
    });

  res.json({
    operationId: operationId,
    status: 'pending',
  });
});

/**
 * POST /v1/telegram/callback
 *
 * @summary Set Phone Code for Authentication
 * @description Provide the phone code received on the user's device to authenticate the session with Telegram.
 * @tags Telegram
 * @param {object} request.body - The request body containing the operation ID and phone code.
 * @return {object} 200 - Success response with session and status
 * @return {object} 404 - Error response if operation not found
 * @example request - Example request body
 * {
 *   "operationId": "some-uuid",
 *   "code": "12345"
 * }
 * @example response - 200 - Success response example
 * {
 *   "session": "session-string",
 *   "status": "code_received"
 * }
 * @example response - 404 - Error response example
 * {
 *   "error": "Operation not found"
 * }
 */
router.post('/callback', isRequired, async (req, res) => {
  const operationId = req.body.operationId;
  const code = req.body.code;

  if (operations[operationId]) {
    operations[operationId].phoneCodePromise.resolve(code);
    const session = operations[operationId].client.session.save();
    res.json({ session: encodeURIComponent(session), status: 'code_received' });
  } else {
    res.status(404).json({ error: 'Operation not found' });
  }
});

/**
 * GET /v1/telegram/status
 *
 * @summary Check Telegram Connection Status
 * @description Check if the Telegram client is currently connected.
 * @tags Telegram
 * @param {string} request.query.session - The session string to identify the client.
 * @return {object} 200 - Success response with connection status
 * @example response - 200 - Success response example
 * {
 *   "status": true // or false
 * }
 */
router.get('/status', isRequired, async (req, res) => {
  const client = TGClient(new StringSession(req.query.session as string));
  await client.connect();
  const status = client.connected;

  res.status(200).json({ status: status });
});

/**
 * GET /v1/telegram/contacts
 *
 * @summary Fetch Telegram Contacts
 * @description Retrieve the contact list associated with the given session.
 * @tags Telegram
 * @param {string} request.query.session - The session string to identify the client.
 * @return {object} 200 - Success response with the list of contacts
 * @example response - 200 - Success response example (simplified for brevity)
 * {
 *   "contacts": [{...}, {...}] // array of contact objects
 * }
 */
router.get('/contacts', isRequired, async (req, res) => {
  const client = TGClient(new StringSession(req.query.session as string));
  await client.connect();

  if (!client.connected) {
    return res.status(200).json([]);
  }

  const contacts = await client.invoke(
    new Api.contacts.GetContacts({
      hash: bigInt('-4156887774564'),
    }),
  );

  return res.status(200).json((contacts as any).users);
});

export default router;
