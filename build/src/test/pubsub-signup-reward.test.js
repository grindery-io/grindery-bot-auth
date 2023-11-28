"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const chai_1 = tslib_1.__importDefault(require("chai"));
const utils_1 = require("./utils");
const signup_reward_1 = require("../utils/webhooks/signup-reward");
const sinon_1 = tslib_1.__importDefault(require("sinon"));
const axios_1 = tslib_1.__importDefault(require("axios"));
const chai_exclude_1 = tslib_1.__importDefault(require("chai-exclude"));
const uuid_1 = require("uuid");
const constants_1 = require("../utils/constants");
const secrets_1 = require("../../secrets");
chai_1.default.use(chai_exclude_1.default);
describe('handleSignUpReward function', async function () {
    let sandbox;
    let axiosStub;
    let rewardId;
    let collectionUsersMock;
    let collectionRewardsMock;
    beforeEach(async function () {
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
                        userOpHash: utils_1.mockUserOpHash,
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
            if (url == secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK) {
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
    describe('Sign up reward already exists with same eventId and is a success', async function () {
        beforeEach(async function () {
            await collectionRewardsMock.insertOne({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                reason: 'user_sign_up',
                status: constants_1.TRANSACTION_STATUS.SUCCESS,
            });
        });
        it('Should return true if Sign up reward already exists with same eventId and is a success', async function () {
            const result = await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should send tokens if Sign up reward already exists with same eventId and is a success', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not update the dabatase if Sign up reward already exists with same eventId and is a success', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default
                .expect(await collectionRewardsMock.find({}).toArray())
                .excluding(['_id'])
                .to.deep.equal([
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    reason: 'user_sign_up',
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                },
            ]);
        });
        it('Should not call FlowXO if Sign up reward already exists with same eventId and is a success', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)).to.be.undefined;
        });
    });
    describe('Sign up reward already exists with another eventId', async function () {
        beforeEach(async function () {
            await collectionRewardsMock.insertOne({
                eventId: 'anotherEventId',
                userTelegramID: utils_1.mockUserTelegramID,
                reason: 'user_sign_up',
                status: constants_1.TRANSACTION_STATUS.SUCCESS,
            });
        });
        it('Should return true if Sign up reward already exists with another eventId', async function () {
            const result = await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should send tokens if Sign up reward already exists with another eventId', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not update the dabatase if Sign up reward already exists with another eventId', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default
                .expect(await collectionRewardsMock.find({}).toArray())
                .excluding(['_id'])
                .to.deep.equal([
                {
                    eventId: 'anotherEventId',
                    userTelegramID: utils_1.mockUserTelegramID,
                    reason: 'user_sign_up',
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                },
            ]);
        });
        it('Should not call FlowXO if Sign up reward already exists with another eventId', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)).to.be.undefined;
        });
    });
    describe('Sign up reward already exists with no eventId', async function () {
        beforeEach(async function () {
            await collectionRewardsMock.insertOne({
                userTelegramID: utils_1.mockUserTelegramID,
                reason: 'user_sign_up',
                status: constants_1.TRANSACTION_STATUS.SUCCESS,
            });
        });
        it('Should return true if Sign up reward already exists with no eventId', async function () {
            const result = await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should send tokens if Sign up reward already exists with no eventId', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not update the dabatase if Sign up reward already exists with no eventId', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default
                .expect(await collectionRewardsMock.find({}).toArray())
                .excluding(['_id'])
                .to.deep.equal([
                {
                    userTelegramID: utils_1.mockUserTelegramID,
                    reason: 'user_sign_up',
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                },
            ]);
        });
        it('Should not call FlowXO if Sign up reward already exists with no eventId', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)).to.be.undefined;
        });
    });
    describe('Sign up reward status pending at the beginning with same eventID', async function () {
        beforeEach(async function () {
            await collectionRewardsMock.insertMany([
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    reason: '2x_reward',
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                },
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    reason: 'user_sign_up',
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                },
            ]);
        });
        it('Should return true if Sign up reward status pending at the beginning with same eventID', async function () {
            const result = await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should call the sendTokens function properly if Sign up reward status pending at the beginning with same eventID', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default
                .expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)
                .args[1])
                .to.deep.equal({
                userId: `grindery:${secrets_1.SOURCE_TG_ID}`,
                chain: 'matic',
                to: [secrets_1.G1_POLYGON_ADDRESS],
                value: ['0x00'],
                data: [
                    '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
                ],
                auth: '',
            });
        });
        it('Should update the database with a success if Sign up reward status pending at the beginning with same eventID', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
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
                    userTelegramID: utils_1.mockUserTelegramID,
                    reason: '2x_reward',
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                },
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    walletAddress: utils_1.mockWallet,
                    reason: 'user_sign_up',
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    amount: '100',
                    message: 'Sign up reward',
                    transactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    userOpHash: null,
                },
            ]);
        });
        it('Should call FlowXO properly if Sign up reward status pending at the beginning with same eventID', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const FlowXOCallArgs = axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK).args[1];
            chai_1.default.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                walletAddress: utils_1.mockWallet,
                reason: 'user_sign_up',
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                amount: '100',
                message: 'Sign up reward',
                transactionHash: utils_1.mockTransactionHash,
            });
            chai_1.default
                .expect(FlowXOCallArgs.dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default.expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
        });
    });
    describe('Sign up reward status failure at the beginning with same eventID', async function () {
        beforeEach(async function () {
            await collectionRewardsMock.insertOne({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                reason: 'user_sign_up',
                status: constants_1.TRANSACTION_STATUS.FAILURE,
            });
        });
        it('Should return true if Sign up reward status is failure at beginning with same eventID', async function () {
            const result = await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should call the sendTokens function properly if Sign up reward status is failure at beginning with same eventID', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default
                .expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)
                .args[1])
                .to.deep.equal({
                userId: `grindery:${secrets_1.SOURCE_TG_ID}`,
                chain: 'matic',
                to: [secrets_1.G1_POLYGON_ADDRESS],
                value: ['0x00'],
                data: [
                    '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
                ],
                auth: '',
            });
        });
        it('Should update reward status if Sign up reward status is failure at beginning with same eventID', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const rewards = await collectionRewardsMock.find({}).toArray();
            chai_1.default
                .expect(rewards)
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    walletAddress: utils_1.mockWallet,
                    reason: 'user_sign_up',
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    amount: '100',
                    message: 'Sign up reward',
                    transactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    userOpHash: null,
                },
            ]);
            chai_1.default
                .expect(rewards[0].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
        });
        it('Should call FlowXO properly if Sign up reward status is failure at beginning with same eventID', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const FlowXOCallArgs = axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK).args[1];
            chai_1.default.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                walletAddress: utils_1.mockWallet,
                reason: 'user_sign_up',
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                amount: '100',
                message: 'Sign up reward',
                transactionHash: utils_1.mockTransactionHash,
            });
            chai_1.default
                .expect(FlowXOCallArgs.dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default.expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
        });
    });
    describe('Normal process with a new user', async function () {
        it('Should call the sendTokens function properly if the user is new', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
                tokenAddress: utils_1.mockTokenAddress,
                chainName: utils_1.mockChainName,
            });
            chai_1.default
                .expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)
                .args[1])
                .to.deep.equal({
                userId: `grindery:${secrets_1.SOURCE_TG_ID}`,
                chain: utils_1.mockChainName,
                to: [utils_1.mockTokenAddress],
                value: ['0x00'],
                data: [
                    '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
                ],
                auth: '',
            });
        });
        it('Should insert a new element in the reward collection of the database if the user is new', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const rewards = await collectionRewardsMock.find({}).toArray();
            chai_1.default.expect(rewards.length).to.equal(1);
            chai_1.default.expect(rewards[0]).excluding(['_id', 'dateAdded']).to.deep.equal({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                walletAddress: utils_1.mockWallet,
                reason: 'user_sign_up',
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                amount: '100',
                message: 'Sign up reward',
                transactionHash: utils_1.mockTransactionHash,
                status: constants_1.TRANSACTION_STATUS.SUCCESS,
                userOpHash: null,
            });
            chai_1.default
                .expect(rewards[0].dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
        });
        it('Should call FlowXO webhook properly if the user is new', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            const FlowXOCallArgs = axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK).args[1];
            chai_1.default.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                walletAddress: utils_1.mockWallet,
                reason: 'user_sign_up',
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                amount: '100',
                message: 'Sign up reward',
                transactionHash: utils_1.mockTransactionHash,
            });
            chai_1.default
                .expect(FlowXOCallArgs.dateAdded)
                .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
            chai_1.default.expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
        });
        it('Should return true if the user is new', async function () {
            chai_1.default.expect(await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            })).to.be.true;
        });
        it('Should not add the user in the database (in handleSignUpReward) if the user is new', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
        });
    });
    it('Should return true if there is an error in FlowXO', async function () {
        axiosStub
            .withArgs(secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)
            .rejects(new Error('Service not available'));
        chai_1.default.expect(await (0, signup_reward_1.handleSignUpReward)({
            eventId: rewardId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
            patchwallet: utils_1.mockWallet,
        })).to.be.true;
    });
    describe('PatchWallet transaction error', function () {
        it('Should return false if there is an error in the transaction', async function () {
            axiosStub
                .withArgs(utils_1.patchwalletTxUrl)
                .rejects(new Error('Service not available'));
            chai_1.default.expect(await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            })).to.be.false;
        });
        it('Should set signup reward to pending in db if there is an error in the transaction', async function () {
            axiosStub
                .withArgs(utils_1.patchwalletTxUrl)
                .rejects(new Error('Service not available'));
            await (0, signup_reward_1.handleSignUpReward)({
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
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    walletAddress: utils_1.mockWallet,
                    reason: 'user_sign_up',
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    amount: '100',
                    message: 'Sign up reward',
                    dateAdded: new Date(),
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                    transactionHash: null,
                    userOpHash: null,
                },
            ]);
        });
        it('Should not call FlowXO if there is an error in the transaction', async function () {
            axiosStub
                .withArgs(utils_1.patchwalletTxUrl)
                .rejects(new Error('Service not available'));
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)).to.be.undefined;
        });
    });
    describe('PatchWallet transaction without hash field in response', function () {
        beforeEach(async function () {
            axiosStub.withArgs(utils_1.patchwalletTxUrl).resolves({
                data: {
                    error: 'service non available',
                },
            });
        });
        it('Should return false if there is no hash in PatchWallet response', async function () {
            chai_1.default.expect(await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            })).to.be.false;
        });
        it('Should set signup reward to pending in db if there is no hash in PatchWallet response', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
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
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    walletAddress: utils_1.mockWallet,
                    reason: 'user_sign_up',
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    amount: '100',
                    message: 'Sign up reward',
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                    transactionHash: null,
                    userOpHash: null,
                },
            ]);
        });
        it('Should not call FlowXO if there is no hash in PatchWallet response', async function () {
            await (0, signup_reward_1.handleSignUpReward)({
                eventId: rewardId,
                userTelegramID: utils_1.mockUserTelegramID,
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)).to.be.undefined;
        });
    });
    describe('Get transaction hash via userOpHash if transaction hash is empty first', async function () {
        describe('Transaction hash is empty in tx PatchWallet endpoint', async function () {
            beforeEach(async function () {
                axiosStub.withArgs(utils_1.patchwalletTxUrl).resolves({
                    data: {
                        txHash: '',
                        userOpHash: utils_1.mockUserOpHash,
                    },
                });
            });
            it('Should return false if transaction hash is empty in tx PatchWallet endpoint', async function () {
                const result = await (0, signup_reward_1.handleSignUpReward)({
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
                await (0, signup_reward_1.handleSignUpReward)({
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
                        userTelegramID: utils_1.mockUserTelegramID,
                        responsePath: utils_1.mockResponsePath,
                        walletAddress: utils_1.mockWallet,
                        reason: 'user_sign_up',
                        userHandle: utils_1.mockUserHandle,
                        userName: utils_1.mockUserName,
                        amount: '100',
                        message: 'Sign up reward',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                        transactionHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
                await (0, signup_reward_1.handleSignUpReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Transaction hash is present in PatchWallet status endpoint', async function () {
            beforeEach(async function () {
                await collectionRewardsMock.insertOne({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    walletAddress: utils_1.mockWallet,
                    reason: 'user_sign_up',
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    amount: '100',
                    message: 'Sign up reward',
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                    userOpHash: utils_1.mockUserOpHash,
                });
            });
            it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
                const result = await (0, signup_reward_1.handleSignUpReward)({
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
                await (0, signup_reward_1.handleSignUpReward)({
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
                await (0, signup_reward_1.handleSignUpReward)({
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
                        userTelegramID: utils_1.mockUserTelegramID,
                        responsePath: utils_1.mockResponsePath,
                        walletAddress: utils_1.mockWallet,
                        reason: 'user_sign_up',
                        userHandle: utils_1.mockUserHandle,
                        userName: utils_1.mockUserName,
                        amount: '100',
                        message: 'Sign up reward',
                        status: constants_1.TRANSACTION_STATUS.SUCCESS,
                        transactionHash: utils_1.mockTransactionHash,
                        userOpHash: utils_1.mockUserOpHash,
                    },
                ]);
            });
            it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
                await (0, signup_reward_1.handleSignUpReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                const FlowXOCallArgs = axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK).args[1];
                chai_1.default.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    walletAddress: utils_1.mockWallet,
                    reason: 'user_sign_up',
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    amount: '100',
                    message: 'Sign up reward',
                    transactionHash: utils_1.mockTransactionHash,
                });
                chai_1.default
                    .expect(FlowXOCallArgs.dateAdded)
                    .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
                chai_1.default.expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
            });
        });
        describe('Transaction hash is not present in PatchWallet status endpoint', async function () {
            beforeEach(async function () {
                await collectionRewardsMock.insertOne({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    walletAddress: utils_1.mockWallet,
                    reason: 'user_sign_up',
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    amount: '100',
                    message: 'Sign up reward',
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                    userOpHash: utils_1.mockUserOpHash,
                });
                axiosStub.withArgs(utils_1.patchwalletTxStatusUrl).resolves({
                    data: {
                        txHash: '',
                        userOpHash: utils_1.mockUserOpHash,
                    },
                });
            });
            it('Should return false if transaction hash is not present in PatchWallet status endpoint', async function () {
                const result = await (0, signup_reward_1.handleSignUpReward)({
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
                await (0, signup_reward_1.handleSignUpReward)({
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
                await (0, signup_reward_1.handleSignUpReward)({
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
                        userTelegramID: utils_1.mockUserTelegramID,
                        responsePath: utils_1.mockResponsePath,
                        walletAddress: utils_1.mockWallet,
                        reason: 'user_sign_up',
                        userHandle: utils_1.mockUserHandle,
                        userName: utils_1.mockUserName,
                        amount: '100',
                        message: 'Sign up reward',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                        transactionHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
                await (0, signup_reward_1.handleSignUpReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Error in PatchWallet get status endpoint', async function () {
            beforeEach(async function () {
                await collectionRewardsMock.insertOne({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    walletAddress: utils_1.mockWallet,
                    reason: 'user_sign_up',
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    amount: '100',
                    message: 'Sign up reward',
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                    userOpHash: utils_1.mockUserOpHash,
                });
                axiosStub
                    .withArgs(utils_1.patchwalletTxStatusUrl)
                    .rejects(new Error('Service not available'));
            });
            it('Should return false if Error in PatchWallet get status endpoint', async function () {
                const result = await (0, signup_reward_1.handleSignUpReward)({
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
                await (0, signup_reward_1.handleSignUpReward)({
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
                await (0, signup_reward_1.handleSignUpReward)({
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
                        userTelegramID: utils_1.mockUserTelegramID,
                        responsePath: utils_1.mockResponsePath,
                        walletAddress: utils_1.mockWallet,
                        reason: 'user_sign_up',
                        userHandle: utils_1.mockUserHandle,
                        userName: utils_1.mockUserName,
                        amount: '100',
                        message: 'Sign up reward',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
                await (0, signup_reward_1.handleSignUpReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Transaction is set to success without transaction hash if pending_hash without userOpHash', async function () {
            beforeEach(async function () {
                await collectionRewardsMock.insertOne({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    walletAddress: utils_1.mockWallet,
                    reason: 'user_sign_up',
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    amount: '100',
                    message: 'Sign up reward',
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                });
            });
            it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
                const result = await (0, signup_reward_1.handleSignUpReward)({
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
                await (0, signup_reward_1.handleSignUpReward)({
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
                await (0, signup_reward_1.handleSignUpReward)({
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
                        userTelegramID: utils_1.mockUserTelegramID,
                        responsePath: utils_1.mockResponsePath,
                        walletAddress: utils_1.mockWallet,
                        reason: 'user_sign_up',
                        userHandle: utils_1.mockUserHandle,
                        userName: utils_1.mockUserName,
                        amount: '100',
                        message: 'Sign up reward',
                        status: constants_1.TRANSACTION_STATUS.SUCCESS,
                        transactionHash: null,
                        userOpHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
                await (0, signup_reward_1.handleSignUpReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Transaction is considered as failure after 10 min of trying to get status', async function () {
            beforeEach(async function () {
                await collectionRewardsMock.insertOne({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    walletAddress: utils_1.mockWallet,
                    reason: 'user_sign_up',
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    amount: '100',
                    message: 'Sign up reward',
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                    userOpHash: utils_1.mockUserOpHash,
                    dateAdded: new Date(Date.now() - 12 * 60 * 1000),
                });
                axiosStub.withArgs(utils_1.patchwalletTxStatusUrl).resolves({
                    data: {
                        txHash: '',
                        userOpHash: utils_1.mockUserOpHash,
                    },
                });
            });
            it('Should return true after 10 min of trying to get status', async function () {
                const result = await (0, signup_reward_1.handleSignUpReward)({
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
                await (0, signup_reward_1.handleSignUpReward)({
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
                await (0, signup_reward_1.handleSignUpReward)({
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
                        userTelegramID: utils_1.mockUserTelegramID,
                        responsePath: utils_1.mockResponsePath,
                        walletAddress: utils_1.mockWallet,
                        reason: 'user_sign_up',
                        userHandle: utils_1.mockUserHandle,
                        userName: utils_1.mockUserName,
                        amount: '100',
                        message: 'Sign up reward',
                        userOpHash: utils_1.mockUserOpHash,
                        status: constants_1.TRANSACTION_STATUS.FAILURE,
                        transactionHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
                await (0, signup_reward_1.handleSignUpReward)({
                    eventId: rewardId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    responsePath: utils_1.mockResponsePath,
                    userHandle: utils_1.mockUserHandle,
                    userName: utils_1.mockUserName,
                    patchwallet: utils_1.mockWallet,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SIGNUP_REWARD_WEBHOOK)).to.be.undefined;
            });
        });
    });
});
//# sourceMappingURL=pubsub-signup-reward.test.js.map