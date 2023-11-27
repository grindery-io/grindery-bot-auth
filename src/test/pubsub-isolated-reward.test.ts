import chai from 'chai';
import {
  mockResponsePath,
  mockUserHandle,
  mockUserName,
  mockUserTelegramID,
  mockWallet,
  mockAccessToken,
  mockTransactionHash,
  patchwalletAuthUrl,
  patchwalletTxUrl,
  mockUserOpHash,
  patchwalletTxStatusUrl,
  mockUserTelegramID1,
  patchwalletResolverUrl,
  mockTokenAddress,
  mockChainName,
  getCollectionUsersMock,
  getCollectionRewardsMock,
} from './utils';
import Sinon from 'sinon';
import axios from 'axios';

import chaiExclude from 'chai-exclude';
import { v4 as uuidv4 } from 'uuid';
import { TRANSACTION_STATUS } from '../utils/constants';
import { handleIsolatedReward } from '../utils/webhooks/isolated-reward';
import {
  FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK,
  G1_POLYGON_ADDRESS,
  SOURCE_TG_ID,
} from '../../secrets';

chai.use(chaiExclude);

describe('handleIsolatedReward function', async function () {
  let sandbox;
  let axiosStub;
  let rewardId;
  let collectionRewardsMock;

  beforeEach(async function () {
    collectionRewardsMock = await getCollectionRewardsMock();

    sandbox = Sinon.createSandbox();
    axiosStub = sandbox.stub(axios, 'post').callsFake(async (url: string) => {
      if (url === patchwalletAuthUrl) {
        return Promise.resolve({
          data: {
            access_token: mockAccessToken,
          },
        });
      }

      if (url === patchwalletTxUrl) {
        return Promise.resolve({
          data: {
            txHash: mockTransactionHash,
            userOpHash: mockUserOpHash,
          },
        });
      }

      if (url === patchwalletResolverUrl) {
        return Promise.resolve({
          data: {
            users: [{ accountAddress: mockWallet }],
          },
        });
      }

      if (url === patchwalletTxStatusUrl) {
        return Promise.resolve({
          data: {
            txHash: mockTransactionHash,
            userOpHash: mockUserOpHash,
          },
        });
      }

      if (url == FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK) {
        return Promise.resolve({
          result: 'success',
        });
      }
      throw new Error('Unexpected URL encountered');
    });
    rewardId = uuidv4();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('Missing fields', async function () {
    it('Should not do anything if userTelegramID is missing', async function () {
      const result = await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: '',
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(result).to.be.true;

      chai.expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;
      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
      ).to.be.undefined;
      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not do anything if eventId is missing', async function () {
      const result = await handleIsolatedReward({
        eventId: '',
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(result).to.be.true;

      chai.expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;
      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
      ).to.be.undefined;
      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not do anything if amount is missing', async function () {
      const result = await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '',
      });

      chai.expect(result).to.be.true;

      chai.expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;
      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
      ).to.be.undefined;
      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not do anything if reason is missing', async function () {
      const result = await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: '',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(result).to.be.true;

      chai.expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;
      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
      ).to.be.undefined;
      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should call the sendTokens function properly if patchwallet is not in the arguments but it is in the database', async function () {
      const collectionUsersMock = await getCollectionUsersMock();
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        reason: 'isolated_reason_1',
        patchwallet: mockWallet,
        status: TRANSACTION_STATUS.SUCCESS,
      });

      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });

      chai
        .expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
            .args[1],
        )
        .to.deep.equal({
          userId: `grindery:${SOURCE_TG_ID}`,
          chain: 'matic',
          to: [G1_POLYGON_ADDRESS],
          value: ['0x00'],
          data: [
            '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
          ],
          auth: '',
        });
    });

    it('Should call the sendTokens function properly if patchwallet is not in the arguments and the user doesnt exist in database yet', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });

      chai
        .expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
            .args[1],
        )
        .to.deep.equal({
          userId: `grindery:${SOURCE_TG_ID}`,
          chain: 'matic',
          to: [G1_POLYGON_ADDRESS],
          value: ['0x00'],
          data: [
            '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
          ],
          auth: '',
        });
    });
  });

  describe('Isolated reward already exists with same eventId and is a success', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertOne({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        reason: 'isolated_reason_1',
        status: TRANSACTION_STATUS.SUCCESS,
      });
    });

    it('Should return true if Isolated reward already exists with same eventId and is a success', async function () {
      const result = await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(result).to.be.true;
    });

    it('Should not send tokens if Isolated reward already exists with same eventId and is a success', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
      ).to.be.undefined;
    });

    it('Should not update the dabatase if Isolated reward already exists with same eventId and is a success', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID,
            reason: 'isolated_reason_1',
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if Isolated reward already exists with same eventId and is a success', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Isolated reward already exists with another eventId', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertOne({
        eventId: 'anotherEventId',
        userTelegramID: mockUserTelegramID,
        reason: 'isolated_reason_1',
        status: TRANSACTION_STATUS.SUCCESS,
      });
    });

    it('Should return true if Isolated reward already exists with another eventId', async function () {
      const result = await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(result).to.be.true;
    });

    it('Should not send tokens if Isolated reward already exists with another eventId', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
      ).to.be.undefined;
    });

    it('Should not update the dabatase if Isolated reward already exists with another eventId', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: 'anotherEventId',
            userTelegramID: mockUserTelegramID,
            reason: 'isolated_reason_1',
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if Isolated reward already exists with another eventId', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Isolated reward already exists with no eventId', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertOne({
        userTelegramID: mockUserTelegramID,
        reason: 'isolated_reason_1',
        status: TRANSACTION_STATUS.SUCCESS,
      });
    });

    it('Should return true if Isolated reward already exists with no eventId', async function () {
      const result = await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(result).to.be.true;
    });

    it('Should not send tokens if Isolated reward already exists with no eventId', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
      ).to.be.undefined;
    });

    it('Should not update the dabatase if Isolated reward already exists with no eventId', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID,
            reason: 'isolated_reason_1',
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if Isolated reward already exists with no eventId', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Isolated reward status pending at the beginning with same eventID', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertOne({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        reason: 'isolated_reason_1',
        status: TRANSACTION_STATUS.PENDING,
      });
    });

    it('Should return true if Isolated reward status pending at the beginning with same eventID', async function () {
      const result = await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });

      chai.expect(result).to.be.true;
    });

    it('Should call the sendTokens function properly if Isolated reward status pending at the beginning with same eventID', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });

      chai
        .expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
            .args[1],
        )
        .to.deep.equal({
          userId: `grindery:${SOURCE_TG_ID}`,
          chain: 'matic',
          to: [G1_POLYGON_ADDRESS],
          value: ['0x00'],
          data: [
            '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
          ],
          auth: '',
        });
    });

    it('Should update the database with a success if Isolated reward status pending at the beginning with same eventID', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: 'isolated_reason_1',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '100',
            message: 'isolated message 1',
            transactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
            userOpHash: null,
          },
        ]);
    });

    it('Should call FlowXO properly if Isolated reward status pending at the beginning with same eventID', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });

      const FlowXOCallArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK).args[1];

      chai.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: 'isolated_reason_1',
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '100',
        message: 'isolated message 1',
        transactionHash: mockTransactionHash,
      });

      chai
        .expect(FlowXOCallArgs.dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
    });
  });

  describe('Isolated reward status failure at the beginning with same eventID', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertOne({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        reason: 'isolated_reason_1',
        status: TRANSACTION_STATUS.FAILURE,
      });
    });

    it('Should return true if Isolated reward status is failure at beginning with same eventID', async function () {
      const result = await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });

      chai.expect(result).to.be.true;
    });

    it('Should call the sendTokens function properly if Isolated reward status is failure at beginning with same eventID', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });

      chai
        .expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
            .args[1],
        )
        .to.deep.equal({
          userId: `grindery:${SOURCE_TG_ID}`,
          chain: 'matic',
          to: [G1_POLYGON_ADDRESS],
          value: ['0x00'],
          data: [
            '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
          ],
          auth: '',
        });
    });

    it('Should update reward status if Isolated reward status is failure at beginning with same eventID', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });

      const rewards = await collectionRewardsMock.find({}).toArray();

      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: 'isolated_reason_1',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '100',
            message: 'isolated message 1',
            transactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
            userOpHash: null,
          },
        ]);

      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should call FlowXO properly if Isolated reward status is failure at beginning with same eventID', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });

      const FlowXOCallArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK).args[1];

      chai.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: 'isolated_reason_1',
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '100',
        message: 'isolated message 1',
        transactionHash: mockTransactionHash,
      });

      chai
        .expect(FlowXOCallArgs.dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
    });
  });

  describe('Normal process with a new user', async function () {
    beforeEach(async function () {
      await collectionRewardsMock.insertMany([
        {
          eventId: 'eventID1',
          userTelegramID: mockUserTelegramID,
          reason: 'isolated_reason_2',
          status: TRANSACTION_STATUS.SUCCESS,
        },
        {
          eventId: 'eventID2',
          userTelegramID: mockUserTelegramID1,
          reason: 'isolated_reason_1',
          status: TRANSACTION_STATUS.SUCCESS,
        },
      ]);
    });

    it('Should call the sendTokens function properly if the reason is new for this user', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
        tokenAddress: mockTokenAddress,
        chainName: mockChainName,
      });
      chai
        .expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl)
            .args[1],
        )
        .to.deep.equal({
          userId: `grindery:${SOURCE_TG_ID}`,
          chain: mockChainName,
          to: [mockTokenAddress],
          value: ['0x00'],
          data: [
            '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d63100000',
          ],
          auth: '',
        });
    });

    it('Should insert a new element in the reward collection of the database if the reason is new for this user', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });
      const rewards = await collectionRewardsMock.find({}).toArray();
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: 'eventID1',
            userTelegramID: mockUserTelegramID,
            reason: 'isolated_reason_2',
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: 'eventID2',
            userTelegramID: mockUserTelegramID1,
            reason: 'isolated_reason_1',
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: 'isolated_reason_1',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '100',
            message: 'isolated message 1',
            transactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
            userOpHash: null,
          },
        ]);
    });

    it('Should call FlowXO webhook properly if the reason is new for this user', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '100',
      });
      const FlowXOCallArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK).args[1];
      chai.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        walletAddress: mockWallet,
        reason: 'isolated_reason_1',
        userHandle: mockUserHandle,
        userName: mockUserName,
        amount: '100',
        message: 'isolated message 1',
        transactionHash: mockTransactionHash,
      });
      chai
        .expect(FlowXOCallArgs.dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should return true if the reason is new for this user', async function () {
      chai.expect(
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '100',
          message: 'isolated message 1',
        }),
      ).to.be.true;
    });
  });

  it('Should return true if there is an error in FlowXO', async function () {
    axiosStub
      .withArgs(FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK)
      .rejects(new Error('Service not available'));

    chai.expect(
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      }),
    ).to.be.true;
  });

  describe('PatchWallet transaction error', function () {
    it('Should return false if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .rejects(new Error('Service not available'));
      chai.expect(
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          message: 'isolated message 1',
          amount: '34',
        }),
      ).to.be.false;
    });

    it('Should set isolated reward to pending in db if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .rejects(new Error('Service not available'));
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });
      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: 'isolated_reason_1',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '34',
            message: 'isolated message 1',
            dateAdded: new Date(),
            status: TRANSACTION_STATUS.PENDING,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(patchwalletTxUrl)
        .rejects(new Error('Service not available'));
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });
      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('PatchWallet transaction without hash field in response', function () {
    beforeEach(async function () {
      axiosStub.withArgs(patchwalletTxUrl).resolves({
        data: {
          error: 'service non available',
        },
      });
    });

    it('Should return false if there is no hash in PatchWallet response', async function () {
      chai.expect(
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          message: 'isolated message 1',
          amount: '34',
        }),
      ).to.be.false;
    });

    it('Should set isolated reward to pending in db if there is no hash in PatchWallet response', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID,
            responsePath: mockResponsePath,
            walletAddress: mockWallet,
            reason: 'isolated_reason_1',
            userHandle: mockUserHandle,
            userName: mockUserName,
            amount: '34',
            message: 'isolated message 1',
            status: TRANSACTION_STATUS.PENDING,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if there is no hash in PatchWallet response', async function () {
      await handleIsolatedReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        reason: 'isolated_reason_1',
        message: 'isolated message 1',
        amount: '34',
      });
      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Get transaction hash via userOpHash if transaction hash is empty first', async function () {
    describe('Transaction hash is empty in tx PatchWallet endpoint', async function () {
      beforeEach(async function () {
        axiosStub.withArgs(patchwalletTxUrl).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });
      it('Should return false if transaction hash is empty in tx PatchWallet endpoint', async function () {
        const result = await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          message: 'isolated message 1',
          amount: '34',
        });
        chai.expect(result).to.be.false;
      });

      it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          message: 'isolated message 1',
          amount: '34',
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'isolated_reason_1',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '34',
              message: 'isolated message 1',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          message: 'isolated message 1',
          amount: '34',
        });
        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction hash is present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          userHandle: mockUserHandle,
          userName: mockUserName,
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
          reason: 'isolated_reason_1',
          message: 'isolated message 1',
          amount: '34',
        });
      });

      it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
        const result = await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          message: 'isolated message 1',
          amount: '34',
        });
        chai.expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          message: 'isolated message 1',
          amount: '34',
        });
        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
        ).to.be.undefined;
      });

      it('Should update the database with a success status if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          message: 'isolated message 1',
          amount: '34',
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'isolated_reason_1',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '34',
              message: 'isolated message 1',
              status: TRANSACTION_STATUS.SUCCESS,
              transactionHash: mockTransactionHash,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          message: 'isolated message 1',
          amount: '34',
        });
        const FlowXOCallArgs = axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK)
          .args[1];
        chai.expect(FlowXOCallArgs).excluding(['dateAdded']).to.deep.equal({
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'isolated_reason_1',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '34',
          message: 'isolated message 1',
          transactionHash: mockTransactionHash,
        });
        chai
          .expect(FlowXOCallArgs.dateAdded)
          .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
        chai.expect(FlowXOCallArgs.dateAdded).to.be.lessThanOrEqual(new Date());
      });
    });

    describe('Transaction hash is not present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          reason: 'isolated_reason_1',
          userHandle: mockUserHandle,
          userName: mockUserName,
          amount: '34',
          message: 'isolated message 1',
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });
        axiosStub.withArgs(patchwalletTxStatusUrl).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if transaction hash is not present in PatchWallet status endpoint', async function () {
        const result = await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(result).to.be.false;
      });

      it('Should not send tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
        ).to.be.undefined;
      });

      it('Should not update database if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'isolated_reason_1',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '34',
              message: 'isolated message 1',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });
    describe('Error in PatchWallet get status endpoint', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          userHandle: mockUserHandle,
          userName: mockUserName,
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        axiosStub
          .withArgs(patchwalletTxStatusUrl)
          .rejects(new Error('Service not available'));
      });

      it('Should return false if Error in PatchWallet get status endpoint', async function () {
        const result = await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(result).to.be.false;
      });

      it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
        ).to.be.undefined;
      });

      it('Should not update database if Error in PatchWallet get status endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'isolated_reason_1',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '34',
              message: 'isolated message 1',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
          ]);
      });
      it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction is set to success without transaction hash if pending_hash without userOpHash', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          userHandle: mockUserHandle,
          userName: mockUserName,
          status: TRANSACTION_STATUS.PENDING_HASH,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
      });

      it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
        const result = await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(result).to.be.true;
      });

      it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
        ).to.be.undefined;
      });

      it('Should update reward database with a success status if transaction hash is pending_hash without userOpHash', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'isolated_reason_1',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '34',
              message: 'isolated message 1',
              status: TRANSACTION_STATUS.SUCCESS,
              transactionHash: null,
              userOpHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction is considered as failure after 10 min of trying to get status', async function () {
      beforeEach(async function () {
        await collectionRewardsMock.insertOne({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          walletAddress: mockWallet,
          userHandle: mockUserHandle,
          userName: mockUserName,
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
          dateAdded: new Date(Date.now() - 12 * 60 * 1000),
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        axiosStub.withArgs(patchwalletTxStatusUrl).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });
      it('Should return true after 10 min of trying to get status', async function () {
        const result = await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(result).to.be.true;
      });

      it('Should not send tokens after 10 min of trying to get status', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === patchwalletTxUrl),
        ).to.be.undefined;
      });

      it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID,
              responsePath: mockResponsePath,
              walletAddress: mockWallet,
              reason: 'isolated_reason_1',
              userHandle: mockUserHandle,
              userName: mockUserName,
              amount: '34',
              message: 'isolated message 1',
              userOpHash: mockUserOpHash,
              status: TRANSACTION_STATUS.FAILURE,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
        await handleIsolatedReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
          reason: 'isolated_reason_1',
          amount: '34',
          message: 'isolated message 1',
        });
        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_ISOLATED_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });
  });
});
