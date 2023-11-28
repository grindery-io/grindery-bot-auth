"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.swapTokens = exports.getTxStatus = exports.sendTokens = exports.getPatchWalletAddressFromTgId = exports.getPatchWalletAccessToken = void 0;
const tslib_1 = require("tslib");
const axios_1 = tslib_1.__importDefault(require("axios"));
const web3_1 = tslib_1.__importDefault(require("web3"));
const ERC20_json_1 = tslib_1.__importDefault(require("../routes/abi/ERC20.json"));
const secrets_1 = require("../../secrets");
async function getPatchWalletAccessToken() {
    return (await axios_1.default.post('https://paymagicapi.com/v1/auth', {
        client_id: await (0, secrets_1.getClientId)(),
        client_secret: await (0, secrets_1.getClientSecret)(),
    }, {
        timeout: 100000,
    })).data.access_token;
}
exports.getPatchWalletAccessToken = getPatchWalletAccessToken;
async function getPatchWalletAddressFromTgId(tgId) {
    return (await axios_1.default.post('https://paymagicapi.com/v1/resolver', {
        userIds: `grindery:${tgId}`,
    }, {
        timeout: 100000,
    })).data.users[0].accountAddress;
}
exports.getPatchWalletAddressFromTgId = getPatchWalletAddressFromTgId;
async function sendTokens(senderTgId, recipientwallet, amountEther, patchWalletAccessToken, tokenAddress = secrets_1.G1_POLYGON_ADDRESS, chainName = 'matic') {
    const g1Contract = new new web3_1.default().eth.Contract(ERC20_json_1.default, tokenAddress);
    return await axios_1.default.post('https://paymagicapi.com/v1/kernel/tx', {
        userId: `grindery:${senderTgId}`,
        chain: chainName,
        to: [tokenAddress],
        value: ['0x00'],
        data: [
            g1Contract.methods['transfer'](recipientwallet, web3_1.default.utils.toWei(amountEther)).encodeABI(),
        ],
        auth: '',
    }, {
        timeout: 100000,
        headers: {
            Authorization: `Bearer ${patchWalletAccessToken}`,
            'Content-Type': 'application/json',
        },
    });
}
exports.sendTokens = sendTokens;
async function getTxStatus(userOpHash) {
    return await axios_1.default.post('https://paymagicapi.com/v1/kernel/txStatus', {
        userOpHash: userOpHash,
    }, {
        timeout: 100000,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}
exports.getTxStatus = getTxStatus;
async function swapTokens(userTelegramID, to, value, data, chainName, patchWalletAccessToken) {
    return await axios_1.default.post('https://paymagicapi.com/v1/kernel/tx', {
        userId: `grindery:${userTelegramID}`,
        chain: chainName ? chainName : 'matic',
        to: [to],
        value: [value],
        data: [data],
        delegatecall: 1,
        auth: '',
    }, {
        timeout: 100000,
        headers: {
            Authorization: `Bearer ${patchWalletAccessToken}`,
            'Content-Type': 'application/json',
        },
    });
}
exports.swapTokens = swapTokens;
//# sourceMappingURL=patchwallet.js.map