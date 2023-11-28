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
const swap_1 = require("../utils/webhooks/swap");
const secrets_1 = require("../../secrets");
chai_1.default.use(chai_exclude_1.default);
describe('handleSwap function', async function () {
    let sandbox;
    let axiosStub;
    let swapId;
    let collectionUsersMock;
    let collectionSwapsMock;
    beforeEach(async function () {
        collectionUsersMock = await (0, utils_1.getCollectionUsersMock)();
        collectionSwapsMock = await (0, utils_1.getCollectionSwapsMock)();
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
            if (url == secrets_1.FLOWXO_NEW_SWAP_WEBHOOK) {
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
        swapId = (0, uuid_1.v4)();
    });
    afterEach(function () {
        sandbox.restore();
    });
    describe('Normal process to handle a swap', async function () {
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
            chai_1.default.expect(await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                userTelegramID: utils_1.mockUserTelegramID,
                to: utils_1.mockToSwap,
                data: utils_1.mockDataSwap,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            })).to.be.true;
        });
        it('Should populate swaps database', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                userTelegramID: utils_1.mockUserTelegramID,
                to: utils_1.mockToSwap,
                data: utils_1.mockDataSwap,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
                chainId: utils_1.mockChainId,
                chainName: utils_1.mockChainName,
            });
            const swaps = await collectionSwapsMock.find({}).toArray();
            chai_1.default
                .expect(swaps)
                .excluding(['dateAdded', '_id'])
                .to.deep.equal([
                {
                    eventId: swapId,
                    TxId: utils_1.mockTransactionHash.substring(1, 8),
                    chainId: utils_1.mockChainId,
                    userTelegramID: utils_1.mockUserTelegramID,
                    userWallet: utils_1.mockWallet,
                    userName: utils_1.mockUserName,
                    userHandle: utils_1.mockUserHandle,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    transactionHash: utils_1.mockTransactionHash,
                    to: utils_1.mockToSwap,
                },
            ]);
            chai_1.default.expect(swaps[0].dateAdded).to.be.a('date');
        });
        it('Should populate the segment swap properly', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                userTelegramID: utils_1.mockUserTelegramID,
                to: utils_1.mockToSwap,
                data: utils_1.mockDataSwap,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            const segmentIdentityCall = axiosStub
                .getCalls()
                .filter((e) => e.firstArg === 'https://api.segment.io/v1/track');
            chai_1.default
                .expect(segmentIdentityCall[0].args[1])
                .excluding(['timestamp'])
                .to.deep.equal({
                userId: utils_1.mockUserTelegramID,
                event: 'Swap',
                properties: {
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    TxId: utils_1.mockTransactionHash.substring(1, 8),
                    transactionHash: utils_1.mockTransactionHash,
                },
            });
        });
        it('Should call FlowXO webhook properly for new swaps', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                to: utils_1.mockToSwap,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            const FlowXOCallArgs = axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK).args[1];
            chai_1.default
                .expect(FlowXOCallArgs)
                .excluding(['dateAdded'])
                .to.deep.equal({
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                userName: utils_1.mockUserName,
                userHandle: utils_1.mockUserHandle,
                userWallet: utils_1.mockWallet,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                to: utils_1.mockToSwap,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
                status: constants_1.TRANSACTION_STATUS.SUCCESS,
                TxId: utils_1.mockTransactionHash.substring(1, 8),
                transactionHash: utils_1.mockTransactionHash,
            });
        });
    });
    describe('Swap is already a success', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertOne({
                userTelegramID: utils_1.mockUserTelegramID,
                userName: utils_1.mockUserName,
                userHandle: utils_1.mockUserHandle,
                patchwallet: utils_1.mockWallet,
            });
            await collectionSwapsMock.insertOne({
                eventId: swapId,
                status: constants_1.TRANSACTION_STATUS.SUCCESS,
            });
        });
        it('Should return true if swap is already a success', async function () {
            chai_1.default.expect(await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            })).to.be.true;
        });
        it('Should not swap token if swap is already a success', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not modify database if swap is already a success', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default
                .expect(await collectionSwapsMock.find({}).toArray())
                .excluding(['_id'])
                .to.deep.equal([
                {
                    eventId: swapId,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
                },
            ]);
        });
        it('Should not call FlowXO if swap is already a success', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if swap is already a success', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    describe('Transaction if swap is already a failure', async function () {
        beforeEach(async function () {
            await collectionUsersMock.insertOne({
                userTelegramID: utils_1.mockUserTelegramID,
                userName: utils_1.mockUserName,
                userHandle: utils_1.mockUserHandle,
                patchwallet: utils_1.mockWallet,
            });
            await collectionSwapsMock.insertOne({
                eventId: swapId,
                status: constants_1.TRANSACTION_STATUS.FAILURE,
            });
        });
        it('Should return true if swap is already a failure', async function () {
            chai_1.default.expect(await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            })).to.be.true;
        });
        it('Should not swap if swap if is already a failure', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not modify database if swap is already a failure', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default
                .expect(await collectionSwapsMock.find({}).toArray())
                .excluding(['_id'])
                .to.deep.equal([
                {
                    eventId: swapId,
                    status: constants_1.TRANSACTION_STATUS.FAILURE,
                },
            ]);
        });
        it('Should not call FlowXO if swap is already a failure', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if swap is already a failure', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    describe('Error in swap token request', async function () {
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
        it('Should return false if there is an error in the swap tokens request', async function () {
            const result = await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(result).to.be.false;
        });
        it('Should not modify transaction status in the database if there is an error in the swap tokens request', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                to: utils_1.mockToSwap,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default
                .expect(await collectionSwapsMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    eventId: swapId,
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                },
            ]);
        });
        it('Should not call FlowXO if there is an error in the swap tokens request', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if there is an error in the swap tokens request', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    it('Should not add new swap if one with the same eventId already exists', async function () {
        await collectionSwapsMock.insertOne({
            eventId: swapId,
        });
        const objectId = (await collectionSwapsMock.findOne({
            eventId: swapId,
        }))._id.toString();
        await collectionUsersMock.insertOne({
            userTelegramID: utils_1.mockUserTelegramID,
            userName: utils_1.mockUserName,
            userHandle: utils_1.mockUserHandle,
            patchwallet: utils_1.mockWallet,
        });
        await (0, swap_1.handleSwap)({
            value: utils_1.mockAmountIn,
            eventId: swapId,
            chainId: 'eip155:137',
            userTelegramID: utils_1.mockUserTelegramID,
            tokenIn: utils_1.mockTokenIn,
            amountIn: utils_1.mockAmountIn,
            tokenOut: utils_1.mockTokenOut,
            amountOut: utils_1.mockAmountOut,
            priceImpact: utils_1.mockPriceImpact,
            gas: utils_1.mockGas,
            from: utils_1.mockFromSwap,
            tokenInSymbol: utils_1.mockTokenInSymbol,
            tokenOutSymbol: utils_1.mockTokenOutSymbol,
        });
        chai_1.default
            .expect((await collectionSwapsMock.find({}).toArray())[0]._id.toString())
            .to.equal(objectId);
    });
    describe('Sender is not a user', async function () {
        it('Should return true if sender is not a user', async function () {
            const result = await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should not save swap in database if sender is not a user', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default
                .expect(await collectionSwapsMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([]);
        });
        it('Should not swap tokens if sender is not a user', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
        });
        it('Should not call FlowXO if sender is not a user', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if sender is not a user', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
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
            const result = await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(result).to.be.false;
        });
        it('Should not modify database if error in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                to: utils_1.mockToSwap,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default
                .expect(await collectionSwapsMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    eventId: swapId,
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                },
            ]);
        });
        it('Should not call FlowXO if error in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if error in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
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
            const result = await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should complete db status to failure in database if error 470 in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                to: utils_1.mockToSwap,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default
                .expect(await collectionSwapsMock.find({}).toArray())
                .excluding(['dateAdded', '_id'])
                .to.deep.equal([
                {
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    userName: utils_1.mockUserName,
                    userHandle: utils_1.mockUserHandle,
                    userWallet: utils_1.mockWallet,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    eventId: swapId,
                    status: constants_1.TRANSACTION_STATUS.FAILURE,
                },
            ]);
        });
        it('Should not call FlowXO if error 470 in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if error 470 in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === 'https://api.segment.io/v1/track')).to.be.undefined;
        });
    });
    describe('PatchWallet 400 error', async function () {
        beforeEach(async function () {
            axiosStub.withArgs(utils_1.patchwalletTxUrl).rejects({
                response: {
                    status: 400,
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
        it('Should return true if error 400 in PatchWallet transaction', async function () {
            const result = await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(result).to.be.true;
        });
        it('Should complete db status to failure in database if error 400 in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                to: utils_1.mockToSwap,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default
                .expect(await collectionSwapsMock.find({}).toArray())
                .excluding(['dateAdded', '_id'])
                .to.deep.equal([
                {
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    userName: utils_1.mockUserName,
                    userHandle: utils_1.mockUserHandle,
                    userWallet: utils_1.mockWallet,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    eventId: swapId,
                    status: constants_1.TRANSACTION_STATUS.FAILURE,
                },
            ]);
        });
        it('Should not call FlowXO if error 400 in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if error 400 in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
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
            const result = await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(result).to.be.false;
        });
        it('Should do no swap status modification in database if no hash in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                to: utils_1.mockToSwap,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default
                .expect(await collectionSwapsMock.find({}).toArray())
                .excluding(['_id', 'dateAdded'])
                .to.deep.equal([
                {
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    eventId: swapId,
                    status: constants_1.TRANSACTION_STATUS.PENDING,
                },
            ]);
        });
        it('Should not call FlowXO if no hash in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
            });
            chai_1.default.expect(axiosStub
                .getCalls()
                .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
        });
        it('Should not call Segment if no hash in PatchWallet transaction', async function () {
            await (0, swap_1.handleSwap)({
                value: utils_1.mockAmountIn,
                eventId: swapId,
                chainId: 'eip155:137',
                userTelegramID: utils_1.mockUserTelegramID,
                tokenIn: utils_1.mockTokenIn,
                amountIn: utils_1.mockAmountIn,
                tokenOut: utils_1.mockTokenOut,
                amountOut: utils_1.mockAmountOut,
                priceImpact: utils_1.mockPriceImpact,
                gas: utils_1.mockGas,
                from: utils_1.mockFromSwap,
                tokenInSymbol: utils_1.mockTokenInSymbol,
                tokenOutSymbol: utils_1.mockTokenOutSymbol,
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
                const result = await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(result).to.be.false;
            });
            it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default
                    .expect(await collectionSwapsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        chainId: 'eip155:137',
                        userTelegramID: utils_1.mockUserTelegramID,
                        userName: utils_1.mockUserName,
                        userHandle: utils_1.mockUserHandle,
                        userWallet: utils_1.mockWallet,
                        tokenIn: utils_1.mockTokenIn,
                        amountIn: utils_1.mockAmountIn,
                        tokenOut: utils_1.mockTokenOut,
                        amountOut: utils_1.mockAmountOut,
                        priceImpact: utils_1.mockPriceImpact,
                        gas: utils_1.mockGas,
                        to: utils_1.mockToSwap,
                        from: utils_1.mockFromSwap,
                        tokenInSymbol: utils_1.mockTokenInSymbol,
                        tokenOutSymbol: utils_1.mockTokenOutSymbol,
                        eventId: swapId,
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
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
                await collectionSwapsMock.insertOne({
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    eventId: swapId,
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                    userOpHash: utils_1.mockUserOpHash,
                });
            });
            it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
                const result = await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(result).to.be.true;
            });
            it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should update the database with a success status if transaction hash is present in PatchWallet status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default
                    .expect(await collectionSwapsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        TxId: utils_1.mockTransactionHash.substring(1, 8),
                        transactionHash: utils_1.mockTransactionHash,
                        chainId: 'eip155:137',
                        userTelegramID: utils_1.mockUserTelegramID,
                        userName: utils_1.mockUserName,
                        userHandle: utils_1.mockUserHandle,
                        userWallet: utils_1.mockWallet,
                        tokenIn: utils_1.mockTokenIn,
                        amountIn: utils_1.mockAmountIn,
                        tokenOut: utils_1.mockTokenOut,
                        amountOut: utils_1.mockAmountOut,
                        priceImpact: utils_1.mockPriceImpact,
                        gas: utils_1.mockGas,
                        to: utils_1.mockToSwap,
                        from: utils_1.mockFromSwap,
                        tokenInSymbol: utils_1.mockTokenInSymbol,
                        tokenOutSymbol: utils_1.mockTokenOutSymbol,
                        eventId: swapId,
                        userOpHash: utils_1.mockUserOpHash,
                        status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    },
                ]);
            });
            it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                const FlowXOCallArgs = axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK).args[1];
                chai_1.default
                    .expect(FlowXOCallArgs)
                    .excluding(['dateAdded'])
                    .to.deep.equal({
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    userName: utils_1.mockUserName,
                    userHandle: utils_1.mockUserHandle,
                    userWallet: utils_1.mockWallet,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    TxId: utils_1.mockTransactionHash.substring(1, 8),
                    transactionHash: utils_1.mockTransactionHash,
                    status: constants_1.TRANSACTION_STATUS.SUCCESS,
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
                await collectionSwapsMock.insertOne({
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    eventId: swapId,
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
                const result = await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(result).to.be.false;
            });
            it('Should not swap tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should not update database if transaction hash is not present in PatchWallet status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default
                    .expect(await collectionSwapsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        chainId: 'eip155:137',
                        userTelegramID: utils_1.mockUserTelegramID,
                        userName: utils_1.mockUserName,
                        userHandle: utils_1.mockUserHandle,
                        userWallet: utils_1.mockWallet,
                        tokenIn: utils_1.mockTokenIn,
                        amountIn: utils_1.mockAmountIn,
                        tokenOut: utils_1.mockTokenOut,
                        amountOut: utils_1.mockAmountOut,
                        priceImpact: utils_1.mockPriceImpact,
                        gas: utils_1.mockGas,
                        to: utils_1.mockToSwap,
                        from: utils_1.mockFromSwap,
                        tokenInSymbol: utils_1.mockTokenInSymbol,
                        tokenOutSymbol: utils_1.mockTokenOutSymbol,
                        eventId: swapId,
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
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
                await collectionSwapsMock.insertOne({
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    eventId: swapId,
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                    userOpHash: utils_1.mockUserOpHash,
                });
                axiosStub
                    .withArgs(utils_1.patchwalletTxStatusUrl)
                    .rejects(new Error('Service not available'));
            });
            it('Should return false if Error in PatchWallet get status endpoint', async function () {
                const result = await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(result).to.be.false;
            });
            it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should not update database if Error in PatchWallet get status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default
                    .expect(await collectionSwapsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        chainId: 'eip155:137',
                        userTelegramID: utils_1.mockUserTelegramID,
                        tokenIn: utils_1.mockTokenIn,
                        amountIn: utils_1.mockAmountIn,
                        tokenOut: utils_1.mockTokenOut,
                        amountOut: utils_1.mockAmountOut,
                        priceImpact: utils_1.mockPriceImpact,
                        gas: utils_1.mockGas,
                        to: utils_1.mockToSwap,
                        from: utils_1.mockFromSwap,
                        tokenInSymbol: utils_1.mockTokenInSymbol,
                        tokenOutSymbol: utils_1.mockTokenOutSymbol,
                        eventId: swapId,
                        status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                        userOpHash: utils_1.mockUserOpHash,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
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
                await collectionSwapsMock.insertOne({
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    eventId: swapId,
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
                const result = await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(result).to.be.true;
            });
            it('Should not send tokens if Error 470 in PatchWallet get status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should update database with failure status if Error 470 in PatchWallet get status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default
                    .expect(await collectionSwapsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        chainId: 'eip155:137',
                        userTelegramID: utils_1.mockUserTelegramID,
                        userName: utils_1.mockUserName,
                        userHandle: utils_1.mockUserHandle,
                        userWallet: utils_1.mockWallet,
                        tokenIn: utils_1.mockTokenIn,
                        amountIn: utils_1.mockAmountIn,
                        tokenOut: utils_1.mockTokenOut,
                        amountOut: utils_1.mockAmountOut,
                        priceImpact: utils_1.mockPriceImpact,
                        gas: utils_1.mockGas,
                        to: utils_1.mockToSwap,
                        from: utils_1.mockFromSwap,
                        tokenInSymbol: utils_1.mockTokenInSymbol,
                        tokenOutSymbol: utils_1.mockTokenOutSymbol,
                        eventId: swapId,
                        status: constants_1.TRANSACTION_STATUS.FAILURE,
                        userOpHash: utils_1.mockUserOpHash,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if Error 470 in PatchWallet get status endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
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
                await collectionSwapsMock.insertOne({
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    eventId: swapId,
                    status: constants_1.TRANSACTION_STATUS.PENDING_HASH,
                });
            });
            it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
                const result = await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(result).to.be.true;
            });
            it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should update reward database with a success status if transaction hash is pending_hash without userOpHash', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default
                    .expect(await collectionSwapsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        chainId: 'eip155:137',
                        userTelegramID: utils_1.mockUserTelegramID,
                        userName: utils_1.mockUserName,
                        userHandle: utils_1.mockUserHandle,
                        userWallet: utils_1.mockWallet,
                        tokenIn: utils_1.mockTokenIn,
                        amountIn: utils_1.mockAmountIn,
                        tokenOut: utils_1.mockTokenOut,
                        amountOut: utils_1.mockAmountOut,
                        priceImpact: utils_1.mockPriceImpact,
                        gas: utils_1.mockGas,
                        to: utils_1.mockToSwap,
                        from: utils_1.mockFromSwap,
                        tokenInSymbol: utils_1.mockTokenInSymbol,
                        tokenOutSymbol: utils_1.mockTokenOutSymbol,
                        eventId: swapId,
                        status: constants_1.TRANSACTION_STATUS.SUCCESS,
                    },
                ]);
            });
            it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
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
                await collectionSwapsMock.insertOne({
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                    eventId: swapId,
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
                const result = await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(result).to.be.true;
            });
            it('Should not send tokens after 10 min of trying to get status', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub.getCalls().find((e) => e.firstArg === utils_1.patchwalletTxUrl)).to.be.undefined;
            });
            it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    to: utils_1.mockToSwap,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default
                    .expect(await collectionSwapsMock.find({}).toArray())
                    .excluding(['_id', 'dateAdded'])
                    .to.deep.equal([
                    {
                        chainId: 'eip155:137',
                        userTelegramID: utils_1.mockUserTelegramID,
                        userName: utils_1.mockUserName,
                        userHandle: utils_1.mockUserHandle,
                        userWallet: utils_1.mockWallet,
                        tokenIn: utils_1.mockTokenIn,
                        amountIn: utils_1.mockAmountIn,
                        tokenOut: utils_1.mockTokenOut,
                        amountOut: utils_1.mockAmountOut,
                        priceImpact: utils_1.mockPriceImpact,
                        gas: utils_1.mockGas,
                        to: utils_1.mockToSwap,
                        from: utils_1.mockFromSwap,
                        tokenInSymbol: utils_1.mockTokenInSymbol,
                        tokenOutSymbol: utils_1.mockTokenOutSymbol,
                        eventId: swapId,
                        status: constants_1.TRANSACTION_STATUS.FAILURE,
                    },
                ]);
            });
            it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
                await (0, swap_1.handleSwap)({
                    value: utils_1.mockAmountIn,
                    eventId: swapId,
                    chainId: 'eip155:137',
                    userTelegramID: utils_1.mockUserTelegramID,
                    tokenIn: utils_1.mockTokenIn,
                    amountIn: utils_1.mockAmountIn,
                    tokenOut: utils_1.mockTokenOut,
                    amountOut: utils_1.mockAmountOut,
                    priceImpact: utils_1.mockPriceImpact,
                    gas: utils_1.mockGas,
                    from: utils_1.mockFromSwap,
                    tokenInSymbol: utils_1.mockTokenInSymbol,
                    tokenOutSymbol: utils_1.mockTokenOutSymbol,
                });
                chai_1.default.expect(axiosStub
                    .getCalls()
                    .find((e) => e.firstArg === secrets_1.FLOWXO_NEW_SWAP_WEBHOOK)).to.be.undefined;
            });
        });
    });
});
//# sourceMappingURL=pubsub-swap.test.js.map