"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramHashIsValid = exports.authenticateApiKey = exports.isRequired = exports.checkToken = void 0;
const tslib_1 = require("tslib");
const axios_1 = tslib_1.__importDefault(require("axios"));
const jwt_decode_1 = tslib_1.__importDefault(require("jwt-decode"));
const crypto_1 = require("crypto");
const secrets_1 = require("../../secrets");
const checkToken = async (token, workspaceKey = undefined) => {
    try {
        await axios_1.default.post('https://orchestrator.grindery.org', {
            jsonrpc: '2.0',
            method: 'or_listWorkflows',
            id: new Date(),
            params: {
                ...(typeof workspaceKey !== 'undefined' && { workspaceKey }),
            },
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        });
    }
    catch (err) {
        throw new Error((err && err.response && err.response.data && err.response.data.message) ||
            err.message ||
            'Invalid token');
    }
};
exports.checkToken = checkToken;
const isRequired = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(403).json({ message: 'No credentials sent' });
    }
    if (!authHeader.startsWith('Bearer ')) {
        return res.status(403).json({ message: 'Wrong authentication method' });
    }
    const token = authHeader.substring(7, authHeader.length);
    try {
        await (0, exports.checkToken)(token);
    }
    catch (err) {
        return res.status(401).json({
            message: (err &&
                err.response &&
                err.response.data &&
                err.response.data.message) ||
                err.message,
        });
    }
    const user = (0, jwt_decode_1.default)(token);
    res.locals.userId = user.sub;
    res.locals.workspaceId = user.workspace;
    next();
};
exports.isRequired = isRequired;
const authenticateApiKey = async (req, res, next) => {
    const apiKey = req.headers['authorization'];
    if (!apiKey) {
        return res.status(401).send({
            msg: 'Missing API key in headers',
        });
    }
    if (apiKey !== `Bearer ${await (0, secrets_1.getApiKey)()}`) {
        return res.status(401).send({
            msg: 'Invalid API key',
        });
    }
    next();
};
exports.authenticateApiKey = authenticateApiKey;
const telegramHashIsValid = async (req, res, next) => {
    const BOT_TOKEN = await (0, secrets_1.getBotToken)();
    if (!BOT_TOKEN) {
        return res.status(500).json({ error: 'Internal server error' });
    }
    const authorization = req.headers['authorization'];
    const hash = authorization.split(' ')[1];
    const data = Object.fromEntries(new URLSearchParams(hash));
    const encoder = new TextEncoder();
    const checkString = Object.keys(data)
        .filter((key) => key !== 'hash')
        .map((key) => `${key}=${data[key]}`)
        .sort()
        .join('\n');
    const secretKey = await crypto_1.webcrypto.subtle.importKey('raw', encoder.encode('WebAppData'), { name: 'HMAC', hash: 'SHA-256' }, true, ['sign']);
    const secret = await crypto_1.webcrypto.subtle.sign('HMAC', secretKey, encoder.encode(BOT_TOKEN));
    const signatureKey = await crypto_1.webcrypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, true, ['sign']);
    const signature = await crypto_1.webcrypto.subtle.sign('HMAC', signatureKey, encoder.encode(checkString));
    const hex = Buffer.from(signature).toString('hex');
    const isValid = data.hash === hex;
    if (!isValid) {
        return res.status(403).json({ error: 'User is not authenticated' });
    }
    next();
};
exports.telegramHashIsValid = telegramHashIsValid;
//# sourceMappingURL=auth.js.map