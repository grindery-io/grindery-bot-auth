import crypto from 'crypto';
import { TELEGRAM_API_HASH } from '../../secrets';

export const encrypt = (text: any, algo = 'aes-256-cbc', format = 'base64') => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    algo,
    Buffer.from(TELEGRAM_API_HASH),
    iv,
  );
  let encrypted = cipher.update(
    text as any,
    'utf-8' as any,
    format as any,
  ) as any;
  encrypted += cipher.final(format as any);
  const ivString = iv.toString(format as any);
  return `${ivString}.${encrypted}`;
};

export const decrypt = (text, algo = 'aes-256-cbc', format = 'base64') => {
  const textParts = text.split('.');
  if (textParts.length !== 2) {
    throw new Error('Invalid encrypted text format');
  }
  const iv = Buffer.from(textParts[0], format as any);
  const encryptedText = textParts[1];
  const decipher = crypto.createDecipheriv(
    algo,
    Buffer.from(TELEGRAM_API_HASH),
    iv,
  );
  let decrypted = decipher.update(encryptedText, format as any, 'utf-8') as any;
  decrypted += decipher.final('utf-8');
  return decrypted;
};
