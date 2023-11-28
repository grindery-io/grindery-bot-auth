"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const chai_1 = tslib_1.__importDefault(require("chai"));
const utils_1 = require("./utils");
const sinon_1 = tslib_1.__importDefault(require("sinon"));
const axios_1 = tslib_1.__importDefault(require("axios"));
const chai_exclude_1 = tslib_1.__importDefault(require("chai-exclude"));
const constants_1 = require("../utils/constants");
const uuid_1 = require("uuid");
const transaction_1 = require("../utils/webhooks/transaction");
const secrets_1 = require("../../secrets");
chai_1.default.use(chai_exclude_1.default);
describe('handleNewTransaction function', async function () {
    let sandbox;
    let axiosStub;
    let txId;
    let collectionUsersMock;
    let collectionTransfersMock;
    beforeEach(async function () {
        collectionUsersMock = await (0, utils_1.getCollectionUsersMock)();
        collectionTransfersMock = await (0, utils_1.getCollectionTransfersMock)();
        sandbox = sinon_1.default.createSandbox();
        axiosStub = sandbox.stub(axios_1.default, 'post').callsFake(async (url) => {
            if (url === utils_1.patchwalletResolverUrl) {
                return Promise.resolve({
                    data: {
                        users: [{ accountAddress: utils_1.mockWallet }],
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
            if (url === utils_1.patchwalletAuthUrl) {
                return Promise.resolve({
                    data: {
                        access_token: utils_1.mockAccessToken,
                    },
                });
            }
            if (url == secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK) {
                return Promise.resolve({
                    result: 'success',
                });
            }
            if (url == utils_1.segmentTrackUrl) {
                return Promise.resolve({
                    result: 'success',
                });
            }
            throw new Error('Unexpected URL encountered');
        });
        txId = (0, uuid_1.v4)();
    });
    afterEach(function () {
        sandbox.restore();
    });
    describe('Normal process to handle a transaction', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertOne({
                userTelegramID: utils_1.mockUserTelegramID,
                userName: utils_1.mockUserName,
                userHandle: utils_1.mockUserHandle,
                patchwallet: utils_1.mockWallet,
                responsePath: utils_1.mockResponsePath,
            });
        });
        it('Should return true', async function () {
            chai_1.default.expect(await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            })).to.be.true;
        });
        it('Should populate transfers database', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
                chainId: utils_1.mockChainId,
                tokenAddress: utils_1.mockTokenAddress,
                chainName: utils_1.mockChainName,
            });
            const transfers = await collectionTransfersMock.find({}).toArray();
            chai_1.default
                .expect(transfers)
                .excluding(['dateAdded', '_id'])
                .to.deep.equal([
                {
                    eventId: txId,
                    chainId: utils_1.mockChainId,
                    tokenSymbol: 'g1',
                    tokenAddress: utils_1.mockTokenAddress,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
                    transactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    userOpHash: null,
                },
            ]);
            chai_1.default.expect(transfers[0].dateAdded).to.be.a('date');
        });
        it('Should populate the segment transfer properly', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            const segmentIdentityCall = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === 'https://api.segment.io/v1/track');
            chai_1.default
                .expect(segmentIdentityCall[0].args[1])
                .excluding(['timestamp'])
                .to.deep.equal({
                userId: utils_1.mockUserTelegramID,
                event: 'Transfer',
                properties: {
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
                    transactionHash: utils_1.mockTransactionHash,
                    eventId: txId,
                },
            });
        });
        it('Should call FlowXO webhook properly for new transactions', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            const FlowXOCallArgs = axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK).args[1];
            chai_1.default.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
                senderResponsePath: utils_1.mockResponsePath,
                chainId: 'eip155:137',
                tokenSymbol: 'g1',
                tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                senderTgId: utils_1.mockUserTelegramID,
                senderWallet: utils_1.mockWallet,
                senderName: utils_1.mockUserName,
                senderHandle: utils_1.mockUserHandle,
                recipientTgId: utils_1.mockUserTelegramID1,
                recipientWallet: utils_1.mockWallet,
                tokenAmount: '100',
                transactionHash: utils_1.mockTransactionHash,
            });
        });
    });
    describe('Transaction is already a success', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertOne({
                userTelegramID: utils_1.mockUserTelegramID,
                userName: utils_1.mockUserName,
                userHandle: utils_1.mockUserHandle,
                patchwallet: utils_1.mockWallet,
            });
            await collectionTransfersMock.insertOne({
                eventId: txId,
                status: constants_1.TRANSACTION_STATUS.SUCCESS,
            });
        });
        it('Should return true and no token sending if transaction is already a success', async function () {
            chai_1.default.expect(await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            })).to.be.true;
        });
        it('Should not send tokens if transaction is already a success', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not modify database if transaction is already a success', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default
                .expect(await collectionTransfersMock.find({}).toArray())
                .excluding(['_id'])
                .to.deep.equal([
                {
                    eventId: txId,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                },
            ]);
        });
        it('Should not call FlowXO is already a success', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment is already a success', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    describe('Transaction if is already a failure', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertOne({
                userTelegramID: utils_1.mockUserTelegramID,
                userName: utils_1.mockUserName,
                userHandle: utils_1.mockUserHandle,
                patchwallet: utils_1.mockWallet,
            });
            await collectionTransfersMock.insertOne({
                eventId: txId,
                status: constants_1.TRANSACTION_STATUS.FAILURE,
            });
        });
        it('Should return true and no token sending if transaction if is already a failure', async function () {
            chai_1.default.expect(await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            })).to.be.true;
        });
        it('Should not send tokens if transaction if is already a failure', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not modify database if transaction if is already a failure', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default
                .expect(await collectionTransfersMock.find({}).toArray())
                .excluding(['_id'])
                .to.deep.equal([
                {
                    eventId: txId,
                    status: constants_1.TRANSACTION_STATUS.FAILURE,
                },
            ]);
        });
        it('Should not call FlowXO if is already a failure', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if is already a failure', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    describe('Error in send token request', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertOne({
                userTelegramID: utils_1.mockUserTelegramID,
                userName: utils_1.mockUserName,
                userHandle: utils_1.mockUserHandle,
                patchwallet: utils_1.mockWallet,
            });
            axiosStub.withArgs(utils_1.patchwalletTxUrl).resolves({
                data: {
                    error: 'service non available',
                },
            });
        });
        it('Should return false if there is an error in the send tokens request', async function () {
            const result = await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(result).to.be.false;
        });
        it('Should not modify transaction status in the database if there is an error in the send tokens request', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default
                .expect(await collectionTransfersMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: txId,
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                    transactionHash: null,
                    userOpHash: null,
                },
            ]);
        });
        it('Should not call FlowXO if there is an error in the send tokens request', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if there is an error in the send tokens request', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    it('Should not add new transaction if one with the same eventId already exists', async function () {
        await collectionTransfersMock.insertOne({
            eventId: txId,
        });
        const objectId = (await collectionTransfersMock.findOne({
            eventId: txId,
        }))._id.toString();
        await collectionUsersMock.insertOne({
            userTelegramID: utils_1.mockUserTelegramID,
            userName: utils_1.mockUserName,
            userHandle: utils_1.mockUserHandle,
            patchwallet: utils_1.mockWallet,
        });
        await (0, transaction_1.handleNewTransaction)({
            senderTgId: utils_1.mockUserTelegramID,
            amount: '100',
            recipientTgId: utils_1.mockUserTelegramID1,
            eventId: txId,
        });
        chai_1.default
            .expect((await collectionTransfersMock.find({}).toArray())[0]._id.toString())
            .to.equal(objectId);
    });
    describe('Sender is not a user', async function () {
        it('Should return true if sender is not a user', async function () {
            const result = await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should not add anything in database if sender is not a user', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(await collectionTransfersMock.find({}).toArray()).to.be.empty;
        });
        it('Should not send tokens if sender is not a user', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not call FlowXO if sender is not a user', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if sender is not a user', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    describe('Error in PatchWallet get address', async function () {
        beforeEach(async function () {
            axiosStub
                .withArgs(utils_1.patchwalletResolverUrl)
                .rejects(new Error('Service not available'));
            await collectionUsersMock.insertOne({
                userTelegramID: utils_1.mockUserTelegramID,
                userName: utils_1.mockUserName,
                userHandle: utils_1.mockUserHandle,
                patchwallet: utils_1.mockWallet,
                responsePath: utils_1.mockResponsePath,
            });
        });
        it('Should return false if error in PatchWallet get address', async function () {
            const result = await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(result).to.be.false;
        });
        it('Should not add anything in the database if error in PatchWallet get address', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(await collectionTransfersMock.find({}).toArray()).to.be.empty;
        });
        it('Should not send tokens if error in PatchWallet get address', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not call FlowXO if error in PatchWallet get address', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if error in PatchWallet get address', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    it('Should return true if error in Segment Webhook', async function () {
        axiosStub
            .withArgs(utils_1.segmentTrackUrl)
            .rejects(new Error('Service not available'));
        await collectionUsersMock.insertOne({
            userTelegramID: utils_1.mockUserTelegramID,
            userName: utils_1.mockUserName,
            userHandle: utils_1.mockUserHandle,
            patchwallet: utils_1.mockWallet,
            responsePath: utils_1.mockResponsePath,
        });
        const result = await (0, transaction_1.handleNewTransaction)({
            senderTgId: utils_1.mockUserTelegramID,
            amount: '100',
            recipientTgId: utils_1.mockUserTelegramID1,
            eventId: txId,
        });
        chai_1.default.expect(result).to.be.true;
    });
    it('Should return true if error in FlowXO Webhook', async function () {
        axiosStub
            .withArgs(secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)
            .rejects(new Error('Service not available'));
        await collectionUsersMock.insertOne({
            userTelegramID: utils_1.mockUserTelegramID,
            userName: utils_1.mockUserName,
            userHandle: utils_1.mockUserHandle,
            patchwallet: utils_1.mockWallet,
            responsePath: utils_1.mockResponsePath,
        });
        const result = await (0, transaction_1.handleNewTransaction)({
            senderTgId: utils_1.mockUserTelegramID,
            amount: '100',
            recipientTgId: utils_1.mockUserTelegramID1,
            eventId: txId,
        });
        chai_1.default.expect(result).to.be.true;
    });
    describe('Error in PatchWallet transaction', async function () {
        beforeEach(async function () {
            axiosStub
                .withArgs(utils_1.patchwalletTxUrl)
                .rejects(new Error('Service not available'));
            await collectionUsersMock.insertOne({
                userTelegramID: utils_1.mockUserTelegramID,
                userName: utils_1.mockUserName,
                userHandle: utils_1.mockUserHandle,
                patchwallet: utils_1.mockWallet,
                responsePath: utils_1.mockResponsePath,
            });
        });
        it('Should return false if error in PatchWallet transaction', async function () {
            const result = await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(result).to.be.false;
        });
        it('Should not modify database if error in PatchWallet transaction', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default
                .expect(await collectionTransfersMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: txId,
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                    transactionHash: null,
                    userOpHash: null,
                },
            ]);
        });
        it('Should not call FlowXO if error in PatchWallet transaction', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if error in PatchWallet transaction', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    describe('PatchWallet 470 error', async function () {
        beforeEach(async function () {
            axiosStub.withArgs(utils_1.patchwalletTxUrl).rejects({
                response: {
                    status: 470,
                },
            });
            await collectionUsersMock.insertOne({
                userTelegramID: utils_1.mockUserTelegramID,
                userName: utils_1.mockUserName,
                userHandle: utils_1.mockUserHandle,
                patchwallet: utils_1.mockWallet,
                responsePath: utils_1.mockResponsePath,
            });
        });
        it('Should return true if error 470 in PatchWallet transaction', async function () {
            const result = await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should complete db status to failure in database if error 470 in PatchWallet transaction', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default
                .expect(await collectionTransfersMock.find({}).toArray())
                .excluding(['dateAdded', '_id'])
                .to.deep.equal([
                {
                    eventId: txId,
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
                    status: constants_1.TRANSACTION_STATUS.FAILURE,
                    transactionHash: null,
                    userOpHash: null,
                },
            ]);
        });
        it('Should not call FlowXO if error 470 in PatchWallet transaction', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if error 470 in PatchWallet transaction', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    describe('No hash in PatchWallet transaction', async function () {
        beforeEach(async function () {
            axiosStub.withArgs(utils_1.patchwalletTxUrl).resolves({
                data: {
                    error: 'service non available',
                },
            });
            await collectionUsersMock.insertOne({
                userTelegramID: utils_1.mockUserTelegramID,
                userName: utils_1.mockUserName,
                userHandle: utils_1.mockUserHandle,
                patchwallet: utils_1.mockWallet,
                responsePath: utils_1.mockResponsePath,
            });
        });
        it('Should return false if no hash in PatchWallet transaction', async function () {
            const result = await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(result).to.be.false;
        });
        it('Should do no transaction status modification in database if no hash in PatchWallet transaction', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default
                .expect(await collectionTransfersMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    eventId: txId,
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                    transactionHash: null,
                    userOpHash: null,
                },
            ]);
        });
        it('Should not call FlowXO if no hash in PatchWallet transaction', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if no hash in PatchWallet transaction', async function () {
            await (0, transaction_1.handleNewTransaction)({
                senderTgId: utils_1.mockUserTelegramID,
                amount: '100',
                recipientTgId: utils_1.mockUserTelegramID1,
                eventId: txId,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    describe('Get transaction hash via userOpHash if transaction hash is empty first', async function () {
        describe('Transaction hash is empty in tx PatchWallet endpoint', async function () {
            beforeEach(async function () {
                await collectionUsersMock.insertOne({
                    userTelegramID: utils_1.mockUserTelegramID,
                    userName: utils_1.mockUserName,
                    userHandle: utils_1.mockUserHandle,
                    patchwallet: utils_1.mockWallet,
                    responsePath: utils_1.mockResponsePath,
                });
                axiosStub.withArgs(utils_1.patchwalletTxUrl).resolves({
                    data: {
                        txHash: '',
                        userOpHash: utils_1.mockUserOpHash,
                    },
                });
            });
            it('Should return false if transaction hash is empty in tx PatchWallet endpoint', async function () {
                const result = await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(result).to.be.false;
            });
            it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default
                    .expect(await collectionTransfersMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: txId,
                        chainId: 'eip155:137',
                        tokenSymbol: 'g1',
                        tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                        senderTgId: utils_1.mockUserTelegramID,
                        senderWallet: utils_1.mockWallet,
                        senderName: utils_1.mockUserName,
                        senderHandle: utils_1.mockUserHandle,
                        recipientTgId: utils_1.mockUserTelegramID1,
                        recipientWallet: utils_1.mockWallet,
                        tokenAmount: '100',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                        transactionHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Transaction hash is present in PatchWallet status endpoint', async function () {
            beforeEach(async function () {
                await collectionUsersMock.insertOne({
                    userTelegramID: utils_1.mockUserTelegramID,
                    userName: utils_1.mockUserName,
                    userHandle: utils_1.mockUserHandle,
                    patchwallet: utils_1.mockWallet,
                    responsePath: utils_1.mockResponsePath,
                });
                await collectionTransfersMock.insertOne({
                    eventId: txId,
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                    userOpHash: utils_1.mockUserOpHash,
                });
            });
            it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
                const result = await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(result).to.be.true;
            });
            it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should update the database with a success status if transaction hash is present in PatchWallet status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default
                    .expect(await collectionTransfersMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: txId,
                        chainId: 'eip155:137',
                        tokenSymbol: 'g1',
                        tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                        senderTgId: utils_1.mockUserTelegramID,
                        senderWallet: utils_1.mockWallet,
                        senderName: utils_1.mockUserName,
                        senderHandle: utils_1.mockUserHandle,
                        recipientTgId: utils_1.mockUserTelegramID1,
                        recipientWallet: utils_1.mockWallet,
                        tokenAmount: '100',
                        status: constants_1.TRANSACTION_STATUS.SUCCESS,
                        userOpHash: utils_1.mockUserOpHash,
                        transactionHash: utils_1.mockTransactionHash,
                    },
                ]);
            });
            it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                const FlowXOCallArgs = axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK).args[1];
                chai_1.default.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
                    senderResponsePath: utils_1.mockResponsePath,
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
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
                await collectionUsersMock.insertOne({
                    userTelegramID: utils_1.mockUserTelegramID,
                    userName: utils_1.mockUserName,
                    userHandle: utils_1.mockUserHandle,
                    patchwallet: utils_1.mockWallet,
                    responsePath: utils_1.mockResponsePath,
                });
                await collectionTransfersMock.insertOne({
                    eventId: txId,
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
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
                const result = await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(result).to.be.false;
            });
            it('Should not send tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should not update database if transaction hash is not present in PatchWallet status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default
                    .expect(await collectionTransfersMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: txId,
                        chainId: 'eip155:137',
                        tokenSymbol: 'g1',
                        tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                        senderTgId: utils_1.mockUserTelegramID,
                        senderWallet: utils_1.mockWallet,
                        senderName: utils_1.mockUserName,
                        senderHandle: utils_1.mockUserHandle,
                        recipientTgId: utils_1.mockUserTelegramID1,
                        recipientWallet: utils_1.mockWallet,
                        tokenAmount: '100',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                        transactionHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Error in PatchWallet get status endpoint', async function () {
            beforeEach(async function () {
                await collectionUsersMock.insertOne({
                    userTelegramID: utils_1.mockUserTelegramID,
                    userName: utils_1.mockUserName,
                    userHandle: utils_1.mockUserHandle,
                    patchwallet: utils_1.mockWallet,
                    responsePath: utils_1.mockResponsePath,
                });
                await collectionTransfersMock.insertOne({
                    eventId: txId,
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                    userOpHash: utils_1.mockUserOpHash,
                });
                axiosStub
                    .withArgs(utils_1.patchwalletTxStatusUrl)
                    .rejects(new Error('Service not available'));
            });
            it('Should return false if Error in PatchWallet get status endpoint', async function () {
                const result = await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(result).to.be.false;
            });
            it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should not update database if Error in PatchWallet get status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default
                    .expect(await collectionTransfersMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: txId,
                        chainId: 'eip155:137',
                        tokenSymbol: 'g1',
                        tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                        senderTgId: utils_1.mockUserTelegramID,
                        senderWallet: utils_1.mockWallet,
                        senderName: utils_1.mockUserName,
                        senderHandle: utils_1.mockUserHandle,
                        recipientTgId: utils_1.mockUserTelegramID1,
                        recipientWallet: utils_1.mockWallet,
                        tokenAmount: '100',
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Error 470 in PatchWallet get status endpoint', async function () {
            beforeEach(async function () {
                await collectionUsersMock.insertOne({
                    userTelegramID: utils_1.mockUserTelegramID,
                    userName: utils_1.mockUserName,
                    userHandle: utils_1.mockUserHandle,
                    patchwallet: utils_1.mockWallet,
                    responsePath: utils_1.mockResponsePath,
                });
                await collectionTransfersMock.insertOne({
                    eventId: txId,
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                    userOpHash: utils_1.mockUserOpHash,
                });
                axiosStub.withArgs(utils_1.patchwalletTxStatusUrl).rejects({
                    response: {
                        status: 470,
                    },
                });
            });
            it('Should return true if Error 470 in PatchWallet get status endpoint', async function () {
                const result = await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(result).to.be.true;
            });
            it('Should not send tokens if Error 470 in PatchWallet get status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should update database with failure status if Error 470 in PatchWallet get status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default
                    .expect(await collectionTransfersMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: txId,
                        chainId: 'eip155:137',
                        tokenSymbol: 'g1',
                        tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                        senderTgId: utils_1.mockUserTelegramID,
                        senderWallet: utils_1.mockWallet,
                        senderName: utils_1.mockUserName,
                        senderHandle: utils_1.mockUserHandle,
                        recipientTgId: utils_1.mockUserTelegramID1,
                        recipientWallet: utils_1.mockWallet,
                        tokenAmount: '100',
                        status: constants_1.TRANSACTION_STATUS.FAILURE,
                        userOpHash: utils_1.mockUserOpHash,
                        transactionHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if Error 470 in PatchWallet get status endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Transaction is set to success without transaction hash if pending_hash without userOpHash', async function () {
            beforeEach(async function () {
                await collectionUsersMock.insertOne({
                    userTelegramID: utils_1.mockUserTelegramID,
                    userName: utils_1.mockUserName,
                    userHandle: utils_1.mockUserHandle,
                    patchwallet: utils_1.mockWallet,
                    responsePath: utils_1.mockResponsePath,
                });
                await collectionTransfersMock.insertOne({
                    eventId: txId,
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                });
            });
            it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
                const result = await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(result).to.be.true;
            });
            it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should update reward database with a success status if transaction hash is pending_hash without userOpHash', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default
                    .expect(await collectionTransfersMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: txId,
                        chainId: 'eip155:137',
                        tokenSymbol: 'g1',
                        tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                        senderTgId: utils_1.mockUserTelegramID,
                        senderWallet: utils_1.mockWallet,
                        senderName: utils_1.mockUserName,
                        senderHandle: utils_1.mockUserHandle,
                        recipientTgId: utils_1.mockUserTelegramID1,
                        recipientWallet: utils_1.mockWallet,
                        tokenAmount: '100',
                        status: constants_1.TRANSACTION_STATUS.SUCCESS,
                        transactionHash: null,
                        userOpHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
            });
        });
        describe('Transaction is considered as failure after 10 min of trying to get status', async function () {
            beforeEach(async function () {
                await collectionUsersMock.insertOne({
                    userTelegramID: utils_1.mockUserTelegramID,
                    userName: utils_1.mockUserName,
                    userHandle: utils_1.mockUserHandle,
                    patchwallet: utils_1.mockWallet,
                    responsePath: utils_1.mockResponsePath,
                });
                await collectionTransfersMock.insertOne({
                    eventId: txId,
                    chainId: 'eip155:137',
                    tokenSymbol: 'g1',
                    tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                    senderTgId: utils_1.mockUserTelegramID,
                    senderWallet: utils_1.mockWallet,
                    senderName: utils_1.mockUserName,
                    senderHandle: utils_1.mockUserHandle,
                    recipientTgId: utils_1.mockUserTelegramID1,
                    recipientWallet: utils_1.mockWallet,
                    tokenAmount: '100',
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
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
                const result = await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(result).to.be.true;
            });
            it('Should not send tokens after 10 min of trying to get status', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default
                    .expect(await collectionTransfersMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        eventId: txId,
                        chainId: 'eip155:137',
                        tokenSymbol: 'g1',
                        tokenAddress: secrets_1.G1_POLYGON_ADDRESS,
                        senderTgId: utils_1.mockUserTelegramID,
                        senderWallet: utils_1.mockWallet,
                        senderName: utils_1.mockUserName,
                        senderHandle: utils_1.mockUserHandle,
                        recipientTgId: utils_1.mockUserTelegramID1,
                        recipientWallet: utils_1.mockWallet,
                        tokenAmount: '100',
                        status: constants_1.TRANSACTION_STATUS.FAILURE,
                        transactionHash: null,
                        userOpHash: null,
                    },
                ]);
            });
            it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
                await (0, transaction_1.handleNewTransaction)({
                    senderTgId: utils_1.mockUserTelegramID,
                    amount: '100',
                    recipientTgId: utils_1.mockUserTelegramID1,
                    eventId: txId,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_TRANSACTION_WEBHOOK)).to.be.undefined;
            });
        });
    });
});
//# sourceMappingURL=pubsub-new-transaction.test.js.map