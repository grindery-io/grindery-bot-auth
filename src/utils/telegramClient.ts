import { TelegramClient } from 'telegram';
import { TELEGRAM_API_HASH, TELEGRAM_API_ID } from '../../secrets';
import { Session } from 'telegram/sessions/Abstract';

const TGClient = (session: string | Session): TelegramClient => {
  return new TelegramClient(
    session,
    Number(TELEGRAM_API_ID),
    TELEGRAM_API_HASH,
    {
      connectionRetries: 5,
    },
  );
};

export default TGClient;
