"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swap_helpers = void 0;
const conn_1 = require("../db/conn");
const constants_1 = require("./constants");
async function findSwapDB(query) {
    const db = await conn_1.Database.getInstance();
    return await db.collection(constants_1.SWAPS_COLLECTION).findOne(query);
}
async function insertSwapDB(db, params) {
    const set = {};
    if (params.txId)
        set.txId = params.txId;
    if (params.eventId)
        set.eventId = params.eventId;
    if (params.chainId)
        set.chainId = params.chainId;
    if (params.to)
        set.to = params.to;
    if (params.from)
        set.from = params.from;
    if (params.userTelegramID)
        set.userTelegramID = params.userTelegramID;
    if (params.userWallet)
        set.userWallet = params.userWallet;
    if (params.userName)
        set.userName = params.userName;
    if (params.userHandle)
        set.userHandle = params.userHandle;
    if (params.tokenInSymbol)
        set.tokenInSymbol = params.tokenInSymbol;
    if (params.tokenIn)
        set.tokenIn = params.tokenIn;
    if (params.amountIn)
        set.amountIn = params.amountIn;
    if (params.tokenOutSymbol)
        set.tokenOutSymbol = params.tokenOutSymbol;
    if (params.tokenOut)
        set.tokenOut = params.tokenOut;
    if (params.amountOut)
        set.amountOut = params.amountOut;
    if (params.priceImpact)
        set.priceImpact = params.priceImpact;
    if (params.gas)
        set.gas = params.gas;
    if (params.status)
        set.status = params.status;
    if (params.transactionHash)
        set.transactionHash = params.transactionHash;
    if (params.userOpHash)
        set.userOpHash = params.userOpHash;
    if (params.dateAdded)
        set.dateAdded = params.dateAdded;
    const result = await db.collection(constants_1.SWAPS_COLLECTION).insertOne(set);
    return result;
}
exports.swap_helpers = {
    findSwapDB,
    insertSwapDB,
};
//# sourceMappingURL=swapHelpers.js.map