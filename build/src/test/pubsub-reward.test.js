"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const chai_1 = tslib_1.__importDefault(require("chai"));
const utils_1 = require("./utils");
const webhook_1 = require("../utils/webhooks/webhook");
const sinon_1 = tslib_1.__importDefault(require("sinon"));
const axios_1 = tslib_1.__importDefault(require("axios"));
const chai_exclude_1 = tslib_1.__importDefault(require("chai-exclude"));
const uuid_1 = require("uuid");
const signup_reward_1 = require("../utils/webhooks/signup-reward");
const referral_reward_1 = require("../utils/webhooks/referral-reward");
const link_reward_1 = require("../utils/webhooks/link-reward");
chai_1.default.use(chai_exclude_1.default);
describe('handleReferralReward function', function () {
    let sandbox;
    let axiosStub;
    let eventId;
    let collectionUsersMock;
    beforeEach(async function () {
        collectionUsersMock = await (0, utils_1.getCollectionUsersMock)();
        sandbox = sinon_1.default.createSandbox();
        axiosStub = sandbox.stub(axios_1.default, 'post').callsFake(async (url) => {
            if (url === utils_1.patchwalletResolverUrl) {
                return Promise.resolve({
                    data: {
                        users: [{ accountAddress: utils_1.mockWallet }],
                    },
                });
            }
            if (url === utils_1.segmentIdentifyUrl) {
                return Promise.resolve({
                    result: 'success',
                });
            }
            throw new Error('Unexpected URL encountered');
        });
        sandbox
            .stub(signup_reward_1.signup_utils, 'handleSignUpReward')
            .callsFake(async function () {
            return true;
        });
        sandbox
            .stub(link_reward_1.link_reward_utils, 'handleLinkReward')
            .callsFake(async function () {
            return true;
        });
        sandbox
            .stub(referral_reward_1.referral_utils, 'handleReferralReward')
            .callsFake(async function () {
            return true;
        });
        eventId = (0, uuid_1.v4)();
    });
    afterEach(function () {
        sandbox.restore();
    });
    it('Should return true with no new user if user is not new', async function () {
        await collectionUsersMock.insertOne({
            userTelegramID: utils_1.mockUserTelegramID,
        });
        const result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
        });
        chai_1.default.expect(result).to.be.true;
        chai_1.default
            .expect(await collectionUsersMock.find({}).toArray())
            .excluding(['_id'])
            .to.deep.equal([
            {
                userTelegramID: utils_1.mockUserTelegramID,
            },
        ]);
    });
    it('Should return true if user is new', async function () {
        const result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
        });
        chai_1.default.expect(result).to.be.true;
    });
    it('Should return false with no new user if signup reward is false', async function () {
        signup_reward_1.signup_utils.handleSignUpReward.callsFake(async function () {
            return false;
        });
        const result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
        });
        chai_1.default.expect(result).to.be.false;
        chai_1.default.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
    });
    it('Should return true and populate database properly after restart', async function () {
        signup_reward_1.signup_utils.handleSignUpReward.callsFake(async function () {
            return false;
        });
        let result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
        });
        chai_1.default.expect(result).to.be.false;
        signup_reward_1.signup_utils.handleSignUpReward.callsFake(async function () {
            return true;
        });
        // Restart
        result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
        });
        const users = await collectionUsersMock.find({}).toArray();
        chai_1.default.expect(result).to.be.true;
        chai_1.default
            .expect(users)
            .excluding(['_id', 'dateAdded'])
            .to.deep.equal([
            {
                userTelegramID: utils_1.mockUserTelegramID,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                responsePath: utils_1.mockResponsePath,
                patchwallet: utils_1.mockWallet,
            },
        ]);
    });
    it('Should return false and no new user if referral reward is false', async function () {
        referral_reward_1.referral_utils.handleReferralReward.callsFake(async function () {
            return false;
        });
        chai_1.default.expect(await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
        })).to.be.false;
        chai_1.default.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
    });
    it('Should be able to restart, return true and populate the database properly after restart', async function () {
        referral_reward_1.referral_utils.handleReferralReward.callsFake(async function () {
            return false;
        });
        let result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
        });
        chai_1.default.expect(result).to.be.false;
        chai_1.default.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
        referral_reward_1.referral_utils.handleReferralReward.callsFake(async function () {
            return true;
        });
        result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
        });
        chai_1.default.expect(result).to.be.true;
        chai_1.default
            .expect(await collectionUsersMock.find({}).toArray())
            .excluding(['_id', 'dateAdded'])
            .to.deep.equal([
            {
                userTelegramID: utils_1.mockUserTelegramID,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                responsePath: utils_1.mockResponsePath,
                patchwallet: utils_1.mockWallet,
            },
        ]);
    });
    it('Should return true and populate database correctly with referral link', async function () {
        const result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
            referentUserTelegramID: utils_1.mockUserTelegramID1,
        });
        chai_1.default.expect(result).to.be.true;
        chai_1.default
            .expect(await collectionUsersMock.find({}).toArray())
            .excluding(['_id', 'dateAdded'])
            .to.deep.equal([
            {
                userTelegramID: utils_1.mockUserTelegramID,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                responsePath: utils_1.mockResponsePath,
                patchwallet: utils_1.mockWallet,
            },
        ]);
    });
    it('Should be able to restart and return true + populate the database properly', async function () {
        link_reward_1.link_reward_utils.handleLinkReward.callsFake(async function () {
            return false;
        });
        let result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
            referentUserTelegramID: utils_1.mockUserTelegramID1,
        });
        chai_1.default.expect(result).to.be.false;
        chai_1.default.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
        link_reward_1.link_reward_utils.handleLinkReward.callsFake(async function () {
            return true;
        });
        result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
            referentUserTelegramID: utils_1.mockUserTelegramID1,
        });
        chai_1.default.expect(result).to.be.true;
        chai_1.default
            .expect(await collectionUsersMock.find({}).toArray())
            .excluding(['_id', 'dateAdded'])
            .to.deep.equal([
            {
                userTelegramID: utils_1.mockUserTelegramID,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                responsePath: utils_1.mockResponsePath,
                patchwallet: utils_1.mockWallet,
            },
        ]);
    });
    it('Should populate the segment user properly', async function () {
        await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: 'newUserTgId',
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
        });
        const segmentIdentityCall = axiosStub
            .getCalls()
            .filter((e) => e.firstArg === utils_1.segmentIdentifyUrl);
        chai_1.default
            .expect(segmentIdentityCall[0].args[1])
            .excluding(['timestamp'])
            .to.deep.equal({
            userId: 'newUserTgId',
            traits: {
                responsePath: utils_1.mockResponsePath,
                userHandle: utils_1.mockUserHandle,
                userName: utils_1.mockUserName,
                patchwallet: utils_1.mockWallet,
            },
        });
        chai_1.default
            .expect(segmentIdentityCall[0].args[1].timestamp)
            .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
        chai_1.default
            .expect(segmentIdentityCall[0].args[1].timestamp)
            .to.be.lessThanOrEqual(new Date());
    });
    it('Should return false with nothing in the database if PatchWallet address error', async function () {
        axiosStub
            .withArgs(utils_1.patchwalletResolverUrl)
            .rejects(new Error('Service not available'));
        const result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
            referentUserTelegramID: utils_1.mockUserTelegramID1,
        });
        chai_1.default.expect(result).to.be.false;
        chai_1.default.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
    });
    it('Should return true if error in Segment', async function () {
        axiosStub
            .withArgs(utils_1.segmentIdentifyUrl)
            .rejects(new Error('Service not available'));
        const result = await (0, webhook_1.handleNewReward)({
            eventId: eventId,
            userTelegramID: utils_1.mockUserTelegramID,
            responsePath: utils_1.mockResponsePath,
            userHandle: utils_1.mockUserHandle,
            userName: utils_1.mockUserName,
            referentUserTelegramID: utils_1.mockUserTelegramID1,
        });
        chai_1.default.expect(result).to.be.true;
    });
});
//# sourceMappingURL=pubsub-reward.test.js.map