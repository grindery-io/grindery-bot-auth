"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const chai_1 = tslib_1.__importDefault(require("chai"));
const utils_1 = require("./utils");
const sinon_1 = tslib_1.__importDefault(require("sinon"));
const axios_1 = tslib_1.__importDefault(require("axios"));
const chai_exclude_1 = tslib_1.__importDefault(require("chai-exclude"));
const uuid_1 = require("uuid");
const constants_1 = require("../utils/constants");
const secrets_1 = require("../../secrets");
const referral_reward_1 = require("../utils/webhooks/referral-reward");
chai_1.default.use(chai_exclude_1.default);
describe('handleReferralReward function', function () {
    let sandbox;
    let axiosStub;
    let rewardId;
    let collectionTransfersMock;
    let collectionUsersMock;
    let collectionRewardsMock;
    beforeEach(async function () {
        collectionTransfersMock = await (0, utils_1.getCollectionTransfersMock)();
        collectionUsersMock = await (0, utils_1.getCollectionUsersMock)();
        collectionRewardsMock = await (0, utils_1.getCollectionRewardsMock)();
        sandbox = sinon_1.default.createSandbox();
        axiosStub = sandbox.stub(axios_1.default, 'post').callsFake(async (url) => {
            if (url === utils_1.patchwalletAuthUrl) {
                return Promise.resolve({
                    data: {
                        access_token: utils_1.mockAccessToken,
                    },
                });
            }
            if (url === utils_1.patchwalletTxUrl) {
                return Promise.resolve({
                    data: {
                        txHash: utils_1.mockTransactionHash,
                    },
                });
            }
            if (url === utils_1.patchwalletTxStatusUrl) {
                return Promise.resolve({
                    data: {
                        txHash: utils_1.mockTransactionHash,
                        userOpHash: utils_1.mockUserOpHash,
                    },
                });
            }
            if (url === utils_1.patchwalletResolverUrl) {
                return Promise.resolve({
                    data: {
                        users: [{ accountAddress: utils_1.mockWallet }],
                    },
                });
            }
            if (url === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK) {
                return Promise.resolve({
                    result: 'success',
                });
            }
            throw new Error('Unexpected URL encountered');
        });
        rewardId = (0, uuid_1.v4)();
    });
    afterEach(function () {
        sandbox.restore();
    });
    describe('No transactions are eligible for a reward', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    patchwallet: utils_1.mockWallet,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                },
                {
                    patchwallet: utils_1.mockWallet1,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID,
                    recipientTgId: 'anotherRecipient',
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: 'anotherRecipient1',
                },
                {
                    transactionHash: utils_1.mockTransactionHash2,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                },
            ]);
        });
        it('Should return true if No transactions are eligible for a reward', async function () {
            const result = await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should not send any tokens if No transactions are eligible for a reward', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not update the reward database if No transactions are eligible for a reward', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;
        });
        it('Should not call FlowXO if No transactions are eligible for a reward', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)).to.be.undefined;
        });
    });
    describe('The transaction is already rewarded with the same eventId', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    patchwallet: utils_1.mockWallet1,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                },
                {
                    patchwallet: utils_1.mockWallet2,
                    userTelegramID: utils_1.mockUserTelegramID2,
                    responsePath: utils_1.mockResponsePath2,
                    userHandle: utils_1.mockUserHandle2,
                    userName: utils_1.mockUserName2,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                },
            ]);
            await collectionRewardsMock.insertMany([
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    parentTransactionHash: utils_1.mockTransactionHash,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                },
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    parentTransactionHash: utils_1.mockTransactionHash1,
                    userTelegramID: utils_1.mockUserTelegramID2,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                },
            ]);
        });
        it('Should return true if The transaction is already rewarded with the same eventId', async function () {
            const result = await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should not send any tokens if The transaction is already rewarded with the same eventId', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not update the database if The transaction is already rewarded with the same eventId', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default
                .expect(await collectionRewardsMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    parentTransactionHash: utils_1.mockTransactionHash,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                },
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    parentTransactionHash: utils_1.mockTransactionHash1,
                    userTelegramID: utils_1.mockUserTelegramID2,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                },
            ]);
        });
        it('Should not call FlowXO if The transaction is already rewarded with the same eventId', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)).to.be.undefined;
        });
    });
    describe('The transaction is already rewarded with another eventId', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    patchwallet: utils_1.mockWallet1,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                },
                {
                    patchwallet: utils_1.mockWallet2,
                    userTelegramID: utils_1.mockUserTelegramID2,
                    responsePath: utils_1.mockResponsePath2,
                    userHandle: utils_1.mockUserHandle2,
                    userName: utils_1.mockUserName2,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                },
            ]);
            await collectionRewardsMock.insertMany([
                {
                    eventId: 'anotherEventId',
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID1,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    newUserAddress: utils_1.mockWallet,
                },
                {
                    eventId: 'anotherEventId',
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID2,
                    parentTransactionHash: utils_1.mockTransactionHash1,
                    newUserAddress: utils_1.mockWallet,
                },
            ]);
        });
        it('Should return true if The transaction is already rewarded with another eventId', async function () {
            const result = await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should not send any tokens if The transaction is already rewarded with another eventId', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not update the database if The transaction is already rewarded with another eventId', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default
                .expect(await collectionRewardsMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: 'anotherEventId',
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID1,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    newUserAddress: utils_1.mockWallet,
                },
                {
                    eventId: 'anotherEventId',
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID2,
                    parentTransactionHash: utils_1.mockTransactionHash1,
                    newUserAddress: utils_1.mockWallet,
                },
            ]);
        });
        it('Should not call FlowXO if The transaction is already rewarded with another eventId', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)).to.be.undefined;
        });
    });
    describe('The transaction is already rewarded with no eventId', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    patchwallet: utils_1.mockWallet1,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                },
                {
                    patchwallet: utils_1.mockWallet2,
                    userTelegramID: utils_1.mockUserTelegramID2,
                    responsePath: utils_1.mockResponsePath2,
                    userHandle: utils_1.mockUserHandle2,
                    userName: utils_1.mockUserName2,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                },
            ]);
            await collectionRewardsMock.insertMany([
                {
                    userTelegramID: utils_1.mockUserTelegramID1,
                    reason: '2x_reward',
                    parentTransactionHash: utils_1.mockTransactionHash,
                    newUserAddress: utils_1.mockWallet,
                },
                {
                    userTelegramID: utils_1.mockUserTelegramID2,
                    reason: '2x_reward',
                    parentTransactionHash: utils_1.mockTransactionHash1,
                    newUserAddress: utils_1.mockWallet,
                },
            ]);
        });
        it('Should return true if The transaction is already rewarded with no eventId', async function () {
            const result = await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should not send any tokens if The transaction is already rewarded with no eventId', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not update the database if The transaction is already rewarded with no eventId', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default
                .expect(await collectionRewardsMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    userTelegramID: utils_1.mockUserTelegramID1,
                    reason: '2x_reward',
                    parentTransactionHash: utils_1.mockTransactionHash,
                    newUserAddress: utils_1.mockWallet,
                },
                {
                    userTelegramID: utils_1.mockUserTelegramID2,
                    reason: '2x_reward',
                    parentTransactionHash: utils_1.mockTransactionHash1,
                    newUserAddress: utils_1.mockWallet,
                },
            ]);
        });
        it('Should not call FlowXO if The transaction is already rewarded with no eventId', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)).to.be.undefined;
        });
    });
    describe('Reward status are pending at the beginning', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    patchwallet: utils_1.mockWallet1,
                },
                {
                    userTelegramID: utils_1.mockUserTelegramID2,
                    responsePath: utils_1.mockResponsePath2,
                    userHandle: utils_1.mockUserHandle2,
                    userName: utils_1.mockUserName2,
                    patchwallet: utils_1.mockWallet2,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    dateAdded: new Date(new Date().getTime() - 5),
                },
            ]);
            await collectionRewardsMock.insertMany([
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID1,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                },
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID1,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                },
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID2,
                    parentTransactionHash: utils_1.mockTransactionHash1,
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                },
            ]);
        });
        it('Should return true if Reward status are pending at the beginning', async function () {
            const result = await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should call the sendTokens function only one time properly if Reward status are pending at the beginning', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
                tokenAddress: utils_1.mockTokenAddress,
                chainName: utils_1.mockChainName,
            });
            const sendTokensCalls = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === utils_1.patchwalletTxUrl);
            chai_1.default.expect(sendTokensCalls.length).to.equal(1);
            chai_1.default.expect(sendTokensCalls[0].args[1]).to.deep.equal({
                userId: `grindery:${secrets_1.SOURCE_TG_ID}`,
                chain: utils_1.mockChainName,
                to: [utils_1.mockTokenAddress],
                value: ['0x00'],
                data: [
                    '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
                ],
                auth: '',
            });
        });
        it('Should add success reward in database if Reward status are pending at the beginning', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const rewards = await collectionRewardsMock.find({}).toArray();
            chai_1.default.expect(rewards.length).to.equal(3);
            chai_1.default
                .expect(rewards)
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    walletAddress: utils_1.mockWallet1,
                    reason: '2x_reward',
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    amount: '50',
                    message: 'Referral reward',
                    transactionHash: utils_1.mockTransactionHash,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    newUserAddress: utils_1.mockWallet,
                    userOpHash: null,
                },
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID1,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                },
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID2,
                    parentTransactionHash: utils_1.mockTransactionHash1,
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                },
            ]);
            chai_1.default
                .expect(rewards[0].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
        });
        it('Should call FlowXO properly if Reward status are pending at the beginning', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const flowXOCalls = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
            chai_1.default.expect(flowXOCalls.length).to.equal(1);
            chai_1.default
                .expect(flowXOCalls[0].args[1])
                .excluding(['dateAdded'])
                .to.deep.equal({
                newUserTgId: utils_1.mockUserTelegramID,
                newUserResponsePath: utils_1.mockResponsePath,
                newUserUserHandle: utils_1.mockUserHandle,
                newUserUserName: utils_1.mockUserName,
                newUserPatchwallet: utils_1.mockWallet,
                userTelegramID: utils_1.mockUserTelegramID1,
                responsePath: utils_1.mockResponsePath1,
                walletAddress: utils_1.mockWallet1,
                reason: '2x_reward',
                userHandle: utils_1.mockUserHandle1,
                userName: utils_1.mockUserName1,
                amount: '50',
                message: 'Referral reward',
                transactionHash: utils_1.mockTransactionHash,
                parentTransactionHash: utils_1.mockTransactionHash,
            });
            chai_1.default
                .expect(flowXOCalls[0].args[1].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default
                .expect(flowXOCalls[0].args[1].dateAdded)
                .to.be.lessThanOrEqual(new Date());
        });
    });
    describe('Reward status are failure at the beginning', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    patchwallet: utils_1.mockWallet1,
                },
                {
                    userTelegramID: utils_1.mockUserTelegramID2,
                    responsePath: utils_1.mockResponsePath2,
                    userHandle: utils_1.mockUserHandle2,
                    userName: utils_1.mockUserName2,
                    patchwallet: utils_1.mockWallet2,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
            ]);
            await collectionRewardsMock.insertMany([
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID1,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.FAILURE,
                    newUserAddress: utils_1.mockWallet,
                },
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID1,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.FAILURE,
                    newUserAddress: utils_1.mockWallet,
                },
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID2,
                    parentTransactionHash: utils_1.mockTransactionHash1,
                    status: constants_1.TRANSACTION_STATUS.FAILURE,
                },
            ]);
        });
        it('Should return true if Reward status are failure at the beginning', async function () {
            const result = await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should call the sendTokens function properly if Reward status are failure at the beginning', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const sendTokensCalls = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === utils_1.patchwalletTxUrl);
            chai_1.default.expect(sendTokensCalls.length).to.equal(1);
            chai_1.default.expect(sendTokensCalls[0].args[1]).to.deep.equal({
                userId: `grindery:${secrets_1.SOURCE_TG_ID}`,
                chain: 'matic',
                to: [secrets_1.G1_POLYGON_ADDRESS],
                value: ['0x00'],
                data: [
                    '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
                ],
                auth: '',
            });
        });
        it('Should add success reward in database if Reward status are failure at the beginning', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const rewards = await collectionRewardsMock.find({}).toArray();
            chai_1.default.expect(rewards.length).to.equal(3);
            chai_1.default
                .expect(rewards)
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    walletAddress: utils_1.mockWallet1,
                    reason: '2x_reward',
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    amount: '50',
                    message: 'Referral reward',
                    transactionHash: utils_1.mockTransactionHash,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    newUserAddress: utils_1.mockWallet,
                    userOpHash: null,
                },
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID1,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.FAILURE,
                    newUserAddress: utils_1.mockWallet,
                },
                {
                    eventId: rewardId,
                    reason: '2x_reward',
                    userTelegramID: utils_1.mockUserTelegramID2,
                    parentTransactionHash: utils_1.mockTransactionHash1,
                    status: constants_1.TRANSACTION_STATUS.FAILURE,
                },
            ]);
            chai_1.default
                .expect(rewards[0].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
        });
        it('Should call FlowXO properly if Reward status are failure at the beginning', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const flowXOCalls = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
            chai_1.default.expect(flowXOCalls.length).to.equal(1);
            chai_1.default
                .expect(flowXOCalls[0].args[1])
                .excluding(['dateAdded'])
                .to.deep.equal({
                newUserTgId: utils_1.mockUserTelegramID,
                newUserResponsePath: utils_1.mockResponsePath,
                newUserUserHandle: utils_1.mockUserHandle,
                newUserUserName: utils_1.mockUserName,
                newUserPatchwallet: utils_1.mockWallet,
                userTelegramID: utils_1.mockUserTelegramID1,
                responsePath: utils_1.mockResponsePath1,
                walletAddress: utils_1.mockWallet1,
                reason: '2x_reward',
                userHandle: utils_1.mockUserHandle1,
                userName: utils_1.mockUserName1,
                amount: '50',
                message: 'Referral reward',
                transactionHash: utils_1.mockTransactionHash,
                parentTransactionHash: utils_1.mockTransactionHash,
            });
            chai_1.default
                .expect(flowXOCalls[0].args[1].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default
                .expect(flowXOCalls[0].args[1].dateAdded)
                .to.be.lessThanOrEqual(new Date());
        });
    });
    describe('Normal process with a new user and transactions to be rewarded', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    patchwallet: utils_1.mockWallet1,
                },
                {
                    userTelegramID: utils_1.mockUserTelegramID2,
                    responsePath: utils_1.mockResponsePath2,
                    userHandle: utils_1.mockUserHandle2,
                    userName: utils_1.mockUserName2,
                    patchwallet: utils_1.mockWallet2,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 5),
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
            ]);
        });
        it('Should return true if transactions to be rewarded', async function () {
            const result = await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should call the sendTokens function only once properly if transactions to be rewarded', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const sendTokensCalls = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === utils_1.patchwalletTxUrl);
            chai_1.default.expect(sendTokensCalls.length).to.equal(1);
            chai_1.default.expect(sendTokensCalls[0].args[1]).to.deep.equal({
                userId: `grindery:${secrets_1.SOURCE_TG_ID}`,
                chain: 'matic',
                to: [secrets_1.G1_POLYGON_ADDRESS],
                value: ['0x00'],
                data: [
                    '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
                ],
                auth: '',
            });
        });
        it('Should add success reward in database if transactions to be rewarded', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const rewards = await collectionRewardsMock.find({}).toArray();
            chai_1.default.expect(rewards.length).to.equal(1);
            chai_1.default
                .expect(rewards)
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    walletAddress: utils_1.mockWallet1,
                    reason: '2x_reward',
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    amount: '50',
                    message: 'Referral reward',
                    transactionHash: utils_1.mockTransactionHash,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    newUserAddress: utils_1.mockWallet,
                    userOpHash: null,
                },
            ]);
            chai_1.default
                .expect(rewards[0].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
        });
        it('Should call FlowXO properly if transactions to be rewarded', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const flowXOCalls = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
            chai_1.default.expect(flowXOCalls.length).to.equal(1);
            chai_1.default
                .expect(flowXOCalls[0].args[1])
                .excluding(['dateAdded'])
                .to.deep.equal({
                newUserTgId: utils_1.mockUserTelegramID,
                newUserResponsePath: utils_1.mockResponsePath,
                newUserUserHandle: utils_1.mockUserHandle,
                newUserUserName: utils_1.mockUserName,
                newUserPatchwallet: utils_1.mockWallet,
                userTelegramID: utils_1.mockUserTelegramID1,
                responsePath: utils_1.mockResponsePath1,
                walletAddress: utils_1.mockWallet1,
                reason: '2x_reward',
                userHandle: utils_1.mockUserHandle1,
                userName: utils_1.mockUserName1,
                amount: '50',
                message: 'Referral reward',
                transactionHash: utils_1.mockTransactionHash,
                parentTransactionHash: utils_1.mockTransactionHash,
            });
            chai_1.default
                .expect(flowXOCalls[0].args[1].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default
                .expect(flowXOCalls[0].args[1].dateAdded)
                .to.be.lessThanOrEqual(new Date());
        });
    });
    describe('Normal process with a new user and transactions to be rewarded but no patchwallet for referent', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                },
                {
                    userTelegramID: utils_1.mockUserTelegramID2,
                    responsePath: utils_1.mockResponsePath2,
                    userHandle: utils_1.mockUserHandle2,
                    userName: utils_1.mockUserName2,
                    patchwallet: utils_1.mockWallet2,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 5),
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
            ]);
        });
        it('Should add success reward in database if transactions to be rewarded', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const rewards = await collectionRewardsMock.find({}).toArray();
            chai_1.default.expect(rewards.length).to.equal(1);
            chai_1.default
                .expect(rewards)
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    walletAddress: utils_1.mockWallet,
                    reason: '2x_reward',
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    amount: '50',
                    message: 'Referral reward',
                    transactionHash: utils_1.mockTransactionHash,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    newUserAddress: utils_1.mockWallet,
                    userOpHash: null,
                },
            ]);
            chai_1.default
                .expect(rewards[0].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
        });
    });
    describe('Normal process with a new user and transactions to be rewarded with same hash', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    patchwallet: utils_1.mockWallet1,
                },
                {
                    userTelegramID: utils_1.mockUserTelegramID2,
                    responsePath: utils_1.mockResponsePath2,
                    userHandle: utils_1.mockUserHandle2,
                    userName: utils_1.mockUserName2,
                    patchwallet: utils_1.mockWallet2,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(Date.now() - 5),
                },
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(Date.now() - 5),
                },
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(Date.now() - 20000),
                },
            ]);
        });
        it('Should return true if transactions to be rewarded with same hash', async function () {
            const result = await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should call the sendTokens function only once properly if transactions to be rewarded with same hash', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const sendTokensCalls = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === utils_1.patchwalletTxUrl);
            chai_1.default.expect(sendTokensCalls.length).to.equal(1);
            chai_1.default.expect(sendTokensCalls[0].args[1]).to.deep.equal({
                userId: `grindery:${secrets_1.SOURCE_TG_ID}`,
                chain: 'matic',
                to: [secrets_1.G1_POLYGON_ADDRESS],
                value: ['0x00'],
                data: [
                    '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
                ],
                auth: '',
            });
        });
        it('Should add success reward in database if transactions to be rewarded with same hash', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const rewards = await collectionRewardsMock.find({}).toArray();
            chai_1.default.expect(rewards.length).to.equal(1);
            chai_1.default
                .expect(rewards)
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    walletAddress: utils_1.mockWallet1,
                    reason: '2x_reward',
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    amount: '50',
                    message: 'Referral reward',
                    transactionHash: utils_1.mockTransactionHash,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    newUserAddress: utils_1.mockWallet,
                    userOpHash: null,
                },
            ]);
            chai_1.default
                .expect(rewards[0].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
        });
        it('Should call FlowXO properly if transactions to be rewarded with same hash', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const flowXOCalls = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
            chai_1.default.expect(flowXOCalls.length).to.equal(1);
            chai_1.default
                .expect(flowXOCalls[0].args[1])
                .excluding(['dateAdded'])
                .to.deep.equal({
                newUserTgId: utils_1.mockUserTelegramID,
                newUserResponsePath: utils_1.mockResponsePath,
                newUserUserHandle: utils_1.mockUserHandle,
                newUserUserName: utils_1.mockUserName,
                newUserPatchwallet: utils_1.mockWallet,
                userTelegramID: utils_1.mockUserTelegramID1,
                responsePath: utils_1.mockResponsePath1,
                walletAddress: utils_1.mockWallet1,
                reason: '2x_reward',
                userHandle: utils_1.mockUserHandle1,
                userName: utils_1.mockUserName1,
                amount: '50',
                message: 'Referral reward',
                transactionHash: utils_1.mockTransactionHash,
                parentTransactionHash: utils_1.mockTransactionHash,
            });
            chai_1.default
                .expect(flowXOCalls[0].args[1].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default
                .expect(flowXOCalls[0].args[1].dateAdded)
                .to.be.lessThanOrEqual(new Date());
        });
    });
    describe('Duplicate user in transactions to be rewarded', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    patchwallet: utils_1.mockWallet1,
                },
                {
                    userTelegramID: utils_1.mockUserTelegramID2,
                    responsePath: utils_1.mockResponsePath2,
                    userHandle: utils_1.mockUserHandle2,
                    userName: utils_1.mockUserName2,
                    patchwallet: utils_1.mockWallet2,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 5),
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 5),
                },
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
            ]);
        });
        it('Should return true if duplicate user in transactions to be rewarded', async function () {
            const result = await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should call the sendTokens function properly only once if duplicate user in transactions to be rewarded', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const sendTokensCalls = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === utils_1.patchwalletTxUrl);
            chai_1.default.expect(sendTokensCalls.length).to.equal(1);
            chai_1.default.expect(sendTokensCalls[0].args[1]).to.deep.equal({
                userId: `grindery:${secrets_1.SOURCE_TG_ID}`,
                chain: 'matic',
                to: [secrets_1.G1_POLYGON_ADDRESS],
                value: ['0x00'],
                data: [
                    '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
                ],
                auth: '',
            });
        });
        it('Should add success reward in database only once if duplicate user in transactions to be rewarded', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const rewards = await collectionRewardsMock.find({}).toArray();
            chai_1.default.expect(rewards.length).to.equal(1);
            chai_1.default
                .expect(rewards)
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    walletAddress: utils_1.mockWallet1,
                    reason: '2x_reward',
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    amount: '50',
                    message: 'Referral reward',
                    transactionHash: utils_1.mockTransactionHash,
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    newUserAddress: utils_1.mockWallet,
                    userOpHash: null,
                },
            ]);
            chai_1.default
                .expect(rewards[0].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
        });
        it('Should call FlowXO properly only one time if duplicate user in transactions to be rewarded', async function () {
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const flowXOCalls = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
            chai_1.default.expect(flowXOCalls.length).to.equal(1);
            chai_1.default
                .expect(flowXOCalls[0].args[1])
                .excluding(['dateAdded'])
                .to.deep.equal({
                newUserTgId: utils_1.mockUserTelegramID,
                newUserResponsePath: utils_1.mockResponsePath,
                newUserUserHandle: utils_1.mockUserHandle,
                newUserUserName: utils_1.mockUserName,
                newUserPatchwallet: utils_1.mockWallet,
                userTelegramID: utils_1.mockUserTelegramID1,
                responsePath: utils_1.mockResponsePath1,
                walletAddress: utils_1.mockWallet1,
                reason: '2x_reward',
                userHandle: utils_1.mockUserHandle1,
                userName: utils_1.mockUserName1,
                amount: '50',
                message: 'Referral reward',
                transactionHash: utils_1.mockTransactionHash,
                parentTransactionHash: utils_1.mockTransactionHash,
            });
            chai_1.default
                .expect(flowXOCalls[0].args[1].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default
                .expect(flowXOCalls[0].args[1].dateAdded)
                .to.be.lessThanOrEqual(new Date());
        });
    });
    it('Should return true if there is an error in FlowXO webhook', async function () {
        axiosStub
            .withArgs(secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)
            .rejects(new Error('Service not available'));
        await collectionUsersMock.insertMany([
            {
                userTelegramID: utils_1.mockUserTelegramID1,
                responsePath: utils_1.mockResponsePath1,
                userHandle: utils_1.mockUserHandle1,
                userName: utils_1.mockUserName1,
                patchwallet: utils_1.mockWallet1,
            },
            {
                userTelegramID: utils_1.mockUserTelegramID2,
                responsePath: utils_1.mockResponsePath2,
                userHandle: utils_1.mockUserHandle2,
                userName: utils_1.mockUserName2,
                patchwallet: utils_1.mockWallet2,
            },
        ]);
        await collectionTransfersMock.insertMany([
            {
                transactionHash: utils_1.mockTransactionHash,
                senderTgId: utils_1.mockUserTelegramID1,
                recipientTgId: utils_1.mockUserTelegramID,
            },
            {
                transactionHash: utils_1.mockTransactionHash1,
                senderTgId: utils_1.mockUserTelegramID2,
                recipientTgId: utils_1.mockUserTelegramID,
            },
        ]);
        chai_1.default.expect(await (0, referral_reward_1.handleReferralReward)({
            eventId: rewardId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
            patchwallet: utils_1.mockWallet,
        })).to.be.true;
    });
    describe('PatchWallet transaction error', function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    patchwallet: utils_1.mockWallet1,
                },
                {
                    userTelegramID: utils_1.mockUserTelegramID2,
                    responsePath: utils_1.mockResponsePath2,
                    userHandle: utils_1.mockUserHandle2,
                    userName: utils_1.mockUserName2,
                    patchwallet: utils_1.mockWallet2,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 5),
                },
            ]);
        });
        it('Should return false if there is an error during the token sending', async function () {
            axiosStub
                .withArgs(utils_1.patchwalletTxUrl)
                .rejects(new Error('Service not available'));
            chai_1.default.expect(await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            })).to.be.false;
        });
        it('Should insert reward as pending in the database if there is an error during the token sending', async function () {
            axiosStub
                .withArgs(utils_1.patchwalletTxUrl)
                .rejects(new Error('Service not available'));
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default
                .expect(await collectionRewardsMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    walletAddress: utils_1.mockWallet1,
                    reason: '2x_reward',
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    amount: '50',
                    message: 'Referral reward',
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                    newUserAddress: utils_1.mockWallet,
                    transactionHash: null,
                    userOpHash: null,
                },
            ]);
        });
        it('Should not call FlowXO webhook if there is an error in the transaction', async function () {
            axiosStub
                .withArgs(utils_1.patchwalletTxUrl)
                .rejects(new Error('Service not available'));
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .filter((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)).to.be.empty;
        });
    });
    describe('PatchWallet transaction without hash', function () {
        beforeEach(async function () {
            await collectionUsersMock.insertMany([
                {
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    patchwallet: utils_1.mockWallet1,
                },
                {
                    userTelegramID: utils_1.mockUserTelegramID2,
                    responsePath: utils_1.mockResponsePath2,
                    userHandle: utils_1.mockUserHandle2,
                    userName: utils_1.mockUserName2,
                    patchwallet: utils_1.mockWallet2,
                },
            ]);
            await collectionTransfersMock.insertMany([
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash,
                    senderTgId: utils_1.mockUserTelegramID1,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 10),
                },
                {
                    transactionHash: utils_1.mockTransactionHash1,
                    senderTgId: utils_1.mockUserTelegramID2,
                    recipientTgId: utils_1.mockUserTelegramID,
                    dateAdded: new Date(new Date().getTime() - 5),
                },
            ]);
        });
        it('Should return false if there is no hash in PatchWallet response', async function () {
            axiosStub.withArgs(utils_1.patchwalletTxUrl).resolves({
                data: {
                    error: 'service non available',
                },
            });
            chai_1.default.expect(await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            })).to.be.false;
        });
        it('Should add a pending in the rewards in the database if there is no hash in PatchWallet response', async function () {
            axiosStub.withArgs(utils_1.patchwalletTxUrl).resolves({
                data: {
                    error: 'service non available',
                },
            });
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default
                .expect(await collectionRewardsMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    walletAddress: utils_1.mockWallet1,
                    reason: '2x_reward',
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    amount: '50',
                    message: 'Referral reward',
                    parentTransactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                    newUserAddress: utils_1.mockWallet,
                    transactionHash: null,
                    userOpHash: null,
                },
            ]);
        });
        it('Should not call FlowXO webhook if there is no hash in PatchWallet response', async function () {
            axiosStub.withArgs(utils_1.patchwalletTxUrl).resolves({
                data: {
                    error: 'service non available',
                },
            });
            await (0, referral_reward_1.handleReferralReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .filter((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)).to.be.empty;
        });
    });
    describe('Get transaction hash via userOpHash if transaction hash is empty first', function () {
        describe('Transaction hash is empty in tx PatchWallet endpoint', async function () {
            beforeEach(async function () {
                axiosStub.withArgs(utils_1.patchwalletTxUrl).resolves({
                    data: {
                        txHash: '',
                        userOpHash: utils_1.mockUserOpHash,
                    },
                });
                await collectionUsersMock.insertMany([
                    {
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        patchwallet: utils_1.mockWallet1,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID2,
                        responsePath: utils_1.mockResponsePath2,
                        userHandle: utils_1.mockUserHandle2,
                        userName: utils_1.mockUserName2,
                        patchwallet: utils_1.mockWallet2,
                    },
                ]);
                await collectionTransfersMock.insertMany([
                    {
                        transactionHash: utils_1.mockTransactionHash,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash2,
                        senderTgId: utils_1.mockUserTelegramID3,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID2,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 5),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: 'anotherUserId',
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                ]);
            });
            it('Should return false if transaction hash is empty in tx PatchWallet endpoint', async function () {
                const result = await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(result).to.be.false;
            });
            it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default
                    .expect(await collectionRewardsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: rewardId,
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        walletAddress: utils_1.mockWallet1,
                        reason: '2x_reward',
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        amount: '50',
                        message: 'Referral reward',
                        parentTransactionHash: utils_1.mockTransactionHash,
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                        newUserAddress: utils_1.mockWallet,
                        transactionHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Transaction hash is present in PatchWallet status endpoint', async function () {
            beforeEach(async function () {
                await collectionUsersMock.insertMany([
                    {
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        patchwallet: utils_1.mockWallet1,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID2,
                        responsePath: utils_1.mockResponsePath2,
                        userHandle: utils_1.mockUserHandle2,
                        userName: utils_1.mockUserName2,
                        patchwallet: utils_1.mockWallet2,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID3,
                        responsePath: utils_1.mockResponsePath3,
                        userHandle: utils_1.mockUserHandle3,
                        userName: utils_1.mockUserName3,
                        patchwallet: utils_1.mockWallet3,
                    },
                ]);
                await collectionTransfersMock.insertMany([
                    {
                        transactionHash: utils_1.mockTransactionHash,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID2,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash2,
                        senderTgId: utils_1.mockUserTelegramID3,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 5),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: 'anotherUserId',
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                ]);
                await collectionRewardsMock.insertMany([
                    {
                        eventId: rewardId,
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        walletAddress: utils_1.mockWallet1,
                        reason: '2x_reward',
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        amount: '50',
                        message: 'Referral reward',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash1,
                        parentTransactionHash: utils_1.mockTransactionHash,
                    },
                ]);
            });
            it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
                const result = await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(result).to.be.true;
            });
            it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should update the database with a success status if transaction hash is present in PatchWallet status endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default
                    .expect(await collectionRewardsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: rewardId,
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        walletAddress: utils_1.mockWallet1,
                        reason: '2x_reward',
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        amount: '50',
                        message: 'Referral reward',
                        status: constants_1.TRANSACTION_STATUS.SUCCESS,
                        userOpHash: utils_1.mockUserOpHash1,
                        transactionHash: utils_1.mockTransactionHash,
                        parentTransactionHash: utils_1.mockTransactionHash,
                        newUserAddress: utils_1.mockWallet,
                    },
                ]);
            });
            it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                const flowXOCalls = axiosStub
                    .getCalls()
                    .filter((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
                chai_1.default.expect(flowXOCalls.length).to.equal(1);
                chai_1.default
                    .expect(flowXOCalls[0].args[1])
                    .excluding(['dateAdded'])
                    .to.deep.equal({
                    newUserTgId: utils_1.mockUserTelegramID,
                    newUserResponsePath: utils_1.mockResponsePath,
                    newUserUserHandle: utils_1.mockUserHandle,
                    newUserUserName: utils_1.mockUserName,
                    newUserPatchwallet: utils_1.mockWallet,
                    userTelegramID: utils_1.mockUserTelegramID1,
                    responsePath: utils_1.mockResponsePath1,
                    walletAddress: utils_1.mockWallet1,
                    reason: '2x_reward',
                    userHandle: utils_1.mockUserHandle1,
                    userName: utils_1.mockUserName1,
                    amount: '50',
                    message: 'Referral reward',
                    transactionHash: utils_1.mockTransactionHash,
                    parentTransactionHash: utils_1.mockTransactionHash,
                });
                chai_1.default
                    .expect(flowXOCalls[0].args[1].dateAdded)
                    .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
                chai_1.default
                    .expect(flowXOCalls[0].args[1].dateAdded)
                    .to.be.lessThanOrEqual(new Date());
            });
        });
        describe('Transaction hash is not present in PatchWallet status endpoint', async function () {
            beforeEach(async function () {
                await collectionUsersMock.insertMany([
                    {
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        patchwallet: utils_1.mockWallet1,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        patchwallet: utils_1.mockWallet1,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID2,
                        responsePath: utils_1.mockResponsePath2,
                        userHandle: utils_1.mockUserHandle2,
                        userName: utils_1.mockUserName2,
                        patchwallet: utils_1.mockWallet2,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID3,
                        responsePath: utils_1.mockResponsePath3,
                        userHandle: utils_1.mockUserHandle3,
                        userName: utils_1.mockUserName3,
                        patchwallet: utils_1.mockWallet3,
                    },
                ]);
                await collectionTransfersMock.insertMany([
                    {
                        transactionHash: utils_1.mockTransactionHash,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID2,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 5),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash2,
                        senderTgId: utils_1.mockUserTelegramID3,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: 'anotherUserId',
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                ]);
                await collectionRewardsMock.insertMany([
                    {
                        eventId: rewardId,
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        walletAddress: utils_1.mockWallet1,
                        reason: '2x_reward',
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        amount: '50',
                        message: 'Referral reward',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                        parentTransactionHash: utils_1.mockTransactionHash,
                    },
                ]);
                axiosStub.withArgs(utils_1.patchwalletTxStatusUrl).resolves({
                    data: {
                        txHash: '',
                        userOpHash: utils_1.mockUserOpHash,
                    },
                });
            });
            it('Should return false if transaction hash is not present in PatchWallet status endpoint', async function () {
                const result = await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(result).to.be.false;
            });
            it('Should not send tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should not update database if transaction hash is not present in PatchWallet status endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default
                    .expect(await collectionRewardsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: rewardId,
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        walletAddress: utils_1.mockWallet1,
                        reason: '2x_reward',
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        amount: '50',
                        message: 'Referral reward',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                        parentTransactionHash: utils_1.mockTransactionHash,
                        newUserAddress: utils_1.mockWallet,
                        transactionHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Error in PatchWallet get status endpoint', async function () {
            beforeEach(async function () {
                await collectionUsersMock.insertMany([
                    {
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        patchwallet: utils_1.mockWallet1,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        patchwallet: utils_1.mockWallet1,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID2,
                        responsePath: utils_1.mockResponsePath2,
                        userHandle: utils_1.mockUserHandle2,
                        userName: utils_1.mockUserName2,
                        patchwallet: utils_1.mockWallet2,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID3,
                        responsePath: utils_1.mockResponsePath3,
                        userHandle: utils_1.mockUserHandle3,
                        userName: utils_1.mockUserName3,
                        patchwallet: utils_1.mockWallet3,
                    },
                ]);
                await collectionTransfersMock.insertMany([
                    {
                        transactionHash: utils_1.mockTransactionHash,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID2,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash2,
                        senderTgId: utils_1.mockUserTelegramID3,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 5),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: 'anotherUserId',
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                ]);
                await collectionRewardsMock.insertMany([
                    {
                        eventId: rewardId,
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        walletAddress: utils_1.mockWallet1,
                        reason: '2x_reward',
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        amount: '50',
                        message: 'Referral reward',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                        parentTransactionHash: utils_1.mockTransactionHash,
                    },
                ]);
                axiosStub
                    .withArgs(utils_1.patchwalletTxStatusUrl)
                    .rejects(new Error('Service not available'));
            });
            it('Should return false if Error in PatchWallet get status endpoint', async function () {
                const result = await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(result).to.be.false;
            });
            it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should not update database if Error in PatchWallet get status endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default
                    .expect(await collectionRewardsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: rewardId,
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        walletAddress: utils_1.mockWallet1,
                        reason: '2x_reward',
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        amount: '50',
                        message: 'Referral reward',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                        parentTransactionHash: utils_1.mockTransactionHash,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Transaction is set to success without transaction hash if pending_hash without userOpHash', async function () {
            beforeEach(async function () {
                await collectionUsersMock.insertMany([
                    {
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        patchwallet: utils_1.mockWallet1,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        patchwallet: utils_1.mockWallet1,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID2,
                        responsePath: utils_1.mockResponsePath2,
                        userHandle: utils_1.mockUserHandle2,
                        userName: utils_1.mockUserName2,
                        patchwallet: utils_1.mockWallet2,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID3,
                        responsePath: utils_1.mockResponsePath3,
                        userHandle: utils_1.mockUserHandle3,
                        userName: utils_1.mockUserName3,
                        patchwallet: utils_1.mockWallet3,
                    },
                ]);
                await collectionTransfersMock.insertMany([
                    {
                        transactionHash: utils_1.mockTransactionHash,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID2,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash2,
                        senderTgId: utils_1.mockUserTelegramID3,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 5),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: 'anotherUserId',
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                ]);
                await collectionRewardsMock.insertMany([
                    {
                        eventId: rewardId,
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        walletAddress: utils_1.mockWallet1,
                        reason: '2x_reward',
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        amount: '50',
                        message: 'Referral reward',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        parentTransactionHash: utils_1.mockTransactionHash,
                    },
                ]);
            });
            it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
                const result = await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(result).to.be.true;
            });
            it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should update reward database with a success status if transaction hash is pending_hash without userOpHash', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default
                    .expect(await collectionRewardsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: rewardId,
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        walletAddress: utils_1.mockWallet1,
                        reason: '2x_reward',
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        amount: '50',
                        message: 'Referral reward',
                        status: constants_1.TRANSACTION_STATUS.SUCCESS,
                        parentTransactionHash: utils_1.mockTransactionHash,
                        newUserAddress: utils_1.mockWallet,
                        transactionHash: null,
                        userOpHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Transaction is considered as failure after 10 min of trying to get status', async function () {
            beforeEach(async function () {
                await collectionUsersMock.insertMany([
                    {
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        patchwallet: utils_1.mockWallet1,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        patchwallet: utils_1.mockWallet1,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID2,
                        responsePath: utils_1.mockResponsePath2,
                        userHandle: utils_1.mockUserHandle2,
                        userName: utils_1.mockUserName2,
                        patchwallet: utils_1.mockWallet2,
                    },
                    {
                        userTelegramID: utils_1.mockUserTelegramID3,
                        responsePath: utils_1.mockResponsePath3,
                        userHandle: utils_1.mockUserHandle3,
                        userName: utils_1.mockUserName3,
                        patchwallet: utils_1.mockWallet3,
                    },
                ]);
                await collectionTransfersMock.insertMany([
                    {
                        transactionHash: utils_1.mockTransactionHash,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID2,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash2,
                        senderTgId: utils_1.mockUserTelegramID3,
                        recipientTgId: utils_1.mockUserTelegramID,
                        dateAdded: new Date(new Date().getTime() - 5),
                    },
                    {
                        transactionHash: utils_1.mockTransactionHash1,
                        senderTgId: utils_1.mockUserTelegramID1,
                        recipientTgId: 'anotherUserId',
                        dateAdded: new Date(new Date().getTime() - 10),
                    },
                ]);
                await collectionRewardsMock.insertMany([
                    {
                        eventId: rewardId,
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        walletAddress: utils_1.mockWallet1,
                        reason: '2x_reward',
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        amount: '50',
                        message: 'Referral reward',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                        parentTransactionHash: utils_1.mockTransactionHash,
                        dateAdded: new Date(Date.now() - 12 * 60 * 1000),
                    },
                ]);
                axiosStub.withArgs(utils_1.patchwalletTxStatusUrl).resolves({
                    data: {
                        txHash: '',
                        userOpHash: utils_1.mockUserOpHash,
                    },
                });
            });
            it('Should return true after 10 min of trying to get status', async function () {
                const result = await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(result).to.be.true;
            });
            it('Should not send tokens after 10 min of trying to get status', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default
                    .expect(await collectionRewardsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: rewardId,
                        userTelegramID: utils_1.mockUserTelegramID1,
                        responsePath: utils_1.mockResponsePath1,
                        walletAddress: utils_1.mockWallet1,
                        reason: '2x_reward',
                        userHandle: utils_1.mockUserHandle1,
                        userName: utils_1.mockUserName1,
                        amount: '50',
                        message: 'Referral reward',
                        status: constants_1.TRANSACTION_STATUS.FAILURE,
                        userOpHash: utils_1.mockUserOpHash,
                        parentTransactionHash: utils_1.mockTransactionHash,
                        newUserAddress: utils_1.mockWallet,
                        transactionHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
                await (0, referral_reward_1.handleReferralReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)).to.be.undefined;
            });
        });
    });
});
//# sourceMappingURL=pubsub-referral-reward.test.js.map