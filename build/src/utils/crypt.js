"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
const tslib_1 = require("tslib");
const crypto_1 = tslib_1.__importDefault(require("crypto"));
const secrets_1 = require("../../secrets");
/**
 * Encrypts the given text using AES encryption with the specified algorithm and encoding format.
 * @param text The text to be encrypted.
 * @param algo The encryption algorithm to use. Defaults to 'aes-256-cbc'.
 * @param format The encoding format for the encrypted text. Defaults to 'base64'.
 * @returns The encrypted text with IV appended as a prefix in the format: IV.EncryptedText.
 */
const encrypt = (text, algo = 'aes-256-cbc', format = 'base64') => {
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv(algo, Buffer.from(secrets_1.TELEGRAM_API_HASH), iv);
    let encrypted = cipher.update(text, 'utf-8', format);
    encrypted += cipher.final(format);
    const ivString = iv.toString(format);
    return `${ivString}.${encrypted}`;
};
exports.encrypt = encrypt;
/**
 * Decrypts the encrypted text using the specified algorithm and encoding format.
 * @param text The encrypted text in the format IV.EncryptedText.
 * @param algo The decryption algorithm to use. Defaults to 'aes-256-cbc'.
 * @param format The encoding format of the encrypted text. Defaults to 'base64'.
 * @returns The decrypted text.
 * @throws Throws an error if the encrypted text format is invalid.
 */
const decrypt = (text, algo = 'aes-256-cbc', format = 'base64') => {
    const textParts = text.split('.');
    if (textParts.length !== 2) {
        throw new Error('Invalid encrypted text format');
    }
    const iv = Buffer.from(textParts[0], format);
    const encryptedText = textParts[1];
    const decipher = crypto_1.default.createDecipheriv(algo, Buffer.from(secrets_1.TELEGRAM_API_HASH), iv);
    let decrypted = decipher.update(encryptedText, format, 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
};
exports.decrypt = decrypt;
//# sourceMappingURL=crypt.js.map