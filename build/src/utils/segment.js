"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addTrackSwapSegment = exports.addTrackSegment = exports.addIdentitySegment = void 0;
const tslib_1 = require("tslib");
const axios_1 = tslib_1.__importDefault(require("axios"));
const secrets_1 = require("../../secrets");
/**
 * Sends user identity information to Segment.
 * @param {any} user - User identity information.
 * @returns {Promise} Returns a Promise representing the result of the HTTP POST request.
 */
async function addIdentitySegment(user) {
    return await axios_1.default.post('https://api.segment.io/v1/identify', {
        userId: user.userTelegramID,
        traits: {
            responsePath: user.responsePath,
            userHandle: user.userHandle,
            userName: user.userName,
            patchwallet: user.patchwallet,
        },
        timestamp: user.dateAdded,
    }, {
        timeout: 100000,
        headers: {
            Authorization: `Bearer ${secrets_1.SEGMENT_KEY}`,
        },
    });
}
exports.addIdentitySegment = addIdentitySegment;
/**
 * Sends a track event to Segment.
 * @param {any} params - Track event parameters.
 * @returns {Promise} Returns a Promise representing the result of the HTTP POST request.
 */
async function addTrackSegment(params) {
    return await axios_1.default.post('https://api.segment.io/v1/track', {
        userId: params.userTelegramID,
        event: 'Transfer',
        properties: {
            chainId: 'eip155:137',
            tokenSymbol: 'g1',
            tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
            senderTgId: params.senderTgId,
            senderWallet: params.senderWallet,
            senderHandle: params.senderHandle,
            senderName: params.senderName,
            recipientTgId: params.recipientTgId,
            recipientWallet: params.recipientWallet,
            tokenAmount: params.tokenAmount,
            transactionHash: params.transactionHash,
            eventId: params.eventId,
        },
        timestamp: params.dateAdded,
    }, {
        timeout: 100000,
        headers: {
            Authorization: `Bearer ${secrets_1.SEGMENT_KEY}`,
        },
    });
}
exports.addTrackSegment = addTrackSegment;
/**
 * Sends a track event to Segment.
 * @param {any} params - Track event parameters.
 * @returns {Promise} Returns a Promise representing the result of the HTTP POST request.
 */
async function addTrackSwapSegment(params) {
    return await axios_1.default.post('https://api.segment.io/v1/track', {
        userId: params.userTelegramID,
        event: 'Swap',
        properties: {
            eventId: params.eventId,
            chainId: params.chainId,
            userTelegramID: params.userTelegramID,
            tokenIn: params.tokenIn,
            amountIn: params.amountIn,
            tokenOut: params.tokenOut,
            amountOut: params.amountOut,
            priceImpact: params.priceImpact,
            gas: params.gas,
            status: params.status,
            TxId: params.TxId,
            transactionHash: params.transactionHash,
            to: params.to,
            from: params.from,
            tokenInSymbol: params.tokenInSymbol,
            tokenOutSymbol: params.tokenOutSymbol,
        },
        timestamp: params.dateAdded,
    }, {
        timeout: 100000,
        headers: {
            Authorization: `Bearer ${secrets_1.SEGMENT_KEY}`,
        },
    });
}
exports.addTrackSwapSegment = addTrackSwapSegment;
//# sourceMappingURL=segment.js.map