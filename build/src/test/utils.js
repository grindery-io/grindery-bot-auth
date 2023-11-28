"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patchwalletResolverUrl = exports.segmentTrackUrl = exports.segmentIdentifyUrl = exports.mockUserOpHash2 = exports.mockUserOpHash1 = exports.mockUserOpHash = exports.mockTransactionHash2 = exports.mockTransactionHash1 = exports.mockTransactionHash = exports.mockAccessToken = exports.mockDataSwap = exports.mockGas = exports.mockPriceImpact = exports.mockAmountOut = exports.mockTokenOut = exports.mockTokenOutSymbol = exports.mockAmountIn = exports.mockTokenIn = exports.mockTokenInSymbol = exports.mockValue = exports.mockFromSwap = exports.mockToSwap = exports.mockChainName = exports.mockChainId = exports.mockTokenAddress = exports.mockWallet3 = exports.mockUserName3 = exports.mockUserHandle3 = exports.mockResponsePath3 = exports.mockUserTelegramID3 = exports.mockWallet2 = exports.mockUserName2 = exports.mockUserHandle2 = exports.mockResponsePath2 = exports.mockUserTelegramID2 = exports.mockWallet1 = exports.mockUserName1 = exports.mockUserHandle1 = exports.mockResponsePath1 = exports.mockUserTelegramID1 = exports.mockWallet = exports.mockUserName = exports.mockUserHandle = exports.mockResponsePath = exports.mockUserTelegramID = exports.getCollectionSwapsMock = exports.getCollectionTransfersMock = exports.getCollectionRewardsMock = exports.getCollectionUsersMock = exports.getDbMock = void 0;
exports.patchwalletTxStatusUrl = exports.patchwalletTxUrl = exports.patchwalletAuthUrl = void 0;
const conn_1 = require("../db/conn");
const constants_1 = require("../utils/constants");
// export const dbMock = await Database.getInstance();
// export const collectionUsersMock = dbMock.collection(USERS_COLLECTION);
// export const collectionRewardsMock = dbMock.collection(REWARDS_COLLECTION);
// export const collectionTransfersMock = dbMock.collection(TRANSFERS_COLLECTION);
// export const collectionSwapsMock = dbMock.collection(SWAPS_COLLECTION);
async function getDbMock() {
    const dbMock = await conn_1.Database.getInstance();
    return dbMock;
}
exports.getDbMock = getDbMock;
async function getCollectionUsersMock() {
    const dbMock = await getDbMock();
    return dbMock.collection(constants_1.USERS_COLLECTION);
}
exports.getCollectionUsersMock = getCollectionUsersMock;
async function getCollectionRewardsMock() {
    const dbMock = await getDbMock();
    return dbMock.collection(constants_1.REWARDS_COLLECTION);
}
exports.getCollectionRewardsMock = getCollectionRewardsMock;
async function getCollectionTransfersMock() {
    const dbMock = await getDbMock();
    return dbMock.collection(constants_1.TRANSFERS_COLLECTION);
}
exports.getCollectionTransfersMock = getCollectionTransfersMock;
async function getCollectionSwapsMock() {
    const dbMock = await getDbMock();
    return dbMock.collection(constants_1.SWAPS_COLLECTION);
}
exports.getCollectionSwapsMock = getCollectionSwapsMock;
exports.mockUserTelegramID = '2114356934';
exports.mockResponsePath = '64d170d6dc5a2a45328ad6f6/c/43320456';
exports.mockUserHandle = 'myUserHandle';
exports.mockUserName = 'myUserName';
exports.mockWallet = '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5';
exports.mockUserTelegramID1 = '2114356931';
exports.mockResponsePath1 = '64d170d6dc5a2a45328ad6f6/c/43320452';
exports.mockUserHandle1 = 'myUserHandle1';
exports.mockUserName1 = 'myUserName1';
exports.mockWallet1 = '0x594CfCaa67Bc8789D17D39eb5F1DfC7dD95242cd';
exports.mockUserTelegramID2 = '2114276931';
exports.mockResponsePath2 = '64d170d6dc5a2a45328ad6f6/c/43320453';
exports.mockUserHandle2 = 'myUserHandle2';
exports.mockUserName2 = 'myUserName2';
exports.mockWallet2 = '0x699791A03Ac2B58E1B7cA29B601C69F223c78e9c';
exports.mockUserTelegramID3 = '2114276967';
exports.mockResponsePath3 = '64d170d6dc5a2a45328ad6f6/c/43322353';
exports.mockUserHandle3 = 'myUserHandle3';
exports.mockUserName3 = 'myUserName3';
exports.mockWallet3 = '0x51a1449b3B6D635EddeC781cD47a99221712De97';
exports.mockTokenAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
exports.mockChainId = 'eip155:55';
exports.mockChainName = 'bnb';
exports.mockToSwap = '0x38147794FF247e5Fc179eDbAE6C37fff88f68C52';
exports.mockFromSwap = '0x699791A03Ac2B58E1B7cA29B601C69F223c78e9c';
exports.mockValue = '1000000';
exports.mockTokenInSymbol = 'USDT';
exports.mockTokenIn = '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063';
exports.mockAmountIn = '1000000';
exports.mockTokenOutSymbol = 'USDC';
exports.mockTokenOut = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
exports.mockAmountOut = '1000333';
exports.mockPriceImpact = '8';
exports.mockGas = '170278';
exports.mockDataSwap = '0x8fd8d1bbf34964a871c716690e00077be071c7ec820cbd6b2db15d90e2198476cfa733be000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000006095ea7b3010001ffffffffffc2132d05d31c914a87c6611c10748aeb04b58e8f19198595a30283ffffffff831111111254eeb25477b68fb85ed929f73a9605829bd3b227018302ffffffff036675a323dedb77822fcf39eaa9d682f6abe72555ddcd52200103ffffffffff037e7d64d987cab6eed08a191c4c2459daf2f8ed0b6e7a43a3010304ffffffff037e7d64d987cab6eed08a191c4c2459daf2f8ed0b241c59120103ffffffffffff7e7d64d987cab6eed08a191c4c2459daf2f8ed0b000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000046000000000000000000000000000000000000000000000000000000000000000200000000000000000000000001111111254eeb25477b68fb85ed929f73a960582000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002c812aa3caf000000000000000000000000e37e799d5077682fa0a244d46e5649f71457bd09000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c3359000000000000000000000000e37e799d5077682fa0a244d46e5649f71457bd09000000000000000000000000b7456c6085009a0721335b925f8aeccbd4a2815f00000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000ecea60000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000013a00000000000000000000000000000000000000000000000000000000011c4330a70dfb3f3b36d69ba3f6efa8949126999906595d00000000000000000000000000000000000000000000000000000000000ecea6002424b31a0c0000000000000000000000001111111254eeb25477b68fb85ed929f73a96058200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fffd8963efd1fc6a506488495d951d5263988d2500000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f000000000000d5504337000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000ecea6';
exports.mockAccessToken = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
exports.mockTransactionHash = '0xd7ca91c2ed1c33fc97366861487e731f0eacbec2bdb76cd09b34679e6cade9b3';
exports.mockTransactionHash1 = '0x93c0ca80f2171b05b68531d176183efcbad940265be5e21b1c12d6f321bd44b9';
exports.mockTransactionHash2 = '0x88be0d614f53ab6cc1339194356980711765ea1511105d4c582e79c099402911';
exports.mockUserOpHash = '0x938cfe7b1fd476d96965d0dfecf86097bb05502856c8eabf175deac507328f3e';
exports.mockUserOpHash1 = '0xacdf0f6fa96a50ca250f759dcd9502c3a16c65b076d6114fc5c53a832897e0a0';
exports.mockUserOpHash2 = '0x072d67eb495c7be8d14f188043065e3c7054a1d12bb15101710c90fea11330cd';
exports.segmentIdentifyUrl = 'https://api.segment.io/v1/identify';
exports.segmentTrackUrl = 'https://api.segment.io/v1/track';
exports.patchwalletResolverUrl = 'https://paymagicapi.com/v1/resolver';
exports.patchwalletAuthUrl = 'https://paymagicapi.com/v1/auth';
exports.patchwalletTxUrl = 'https://paymagicapi.com/v1/kernel/tx';
exports.patchwalletTxStatusUrl = 'https://paymagicapi.com/v1/kernel/txStatus';
//# sourceMappingURL=utils.js.map