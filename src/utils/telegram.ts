import { Api } from 'telegram';
import { StringSession } from 'telegram/sessions/index';
import TGClient from './telegramClient';
import { decrypt } from './crypt';
import { WithId, Document } from 'mongodb';

/**
 * Extracts user information from the request headers.
 * @param req The request object containing headers, particularly the 'authorization' header with user data.
 * @returns The user information parsed from the request headers.
 */
export const getUser = (req: { headers: { [x: string]: any } }): any => {
  const authorization = req.headers['authorization'];
  const token = authorization.split(' ')[1];
  const data = Object.fromEntries(new URLSearchParams(token));
  const user = JSON.parse((data.user || {}) as string);
  return user;
};

/**
 * Sends a message via Telegram to a recipient.
 * @param message The content of the message to be sent.
 * @param recipientId The Telegram ID of the message recipient.
 * @param senderUser The sender's user information containing userHandle and telegramSession.
 * @returns A Promise that resolves to an object indicating the success status and a descriptive message.
 *          - success: A boolean indicating if the message was sent successfully.
 *          - message: A string providing details about the status of the message sending process.
 */
export const sendTelegramMessage = async (
  message: string,
  recipientId: string,
  senderUser: WithId<Document>,
): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    if (!message) throw new Error('Message is required');
    if (!recipientId) throw new Error('Recipient ID is required');
    if (!senderUser.userHandle) throw new Error('Sender username not found');
    if (!senderUser.telegramSession)
      throw new Error('Telegram session not found');

    const client = TGClient(
      new StringSession(decrypt(senderUser.telegramSession)),
    );

    await client.connect();

    if (!client.connected) {
      throw new Error('Telegram client not connected');
    }

    // get recipient handle
    const recipient = await client.invoke(
      new Api.users.GetFullUser({
        id: recipientId,
      }),
    );

    const recipientHandle =
      (recipient &&
        recipient.users &&
        recipient.users[0] &&
        (recipient.users[0] as any).username) ||
      '';

    const data = {
      peer: recipientHandle,
      message: message,
    };

    const result = await client.invoke(new Api.messages.SendMessage(data));

    if (result) {
      return { success: true, message: 'Message sent successfully' };
    } else {
      return { success: false, message: 'Message sending failed' };
    }
  } catch (error) {
    return { success: false, message: error.message };
  }
};
