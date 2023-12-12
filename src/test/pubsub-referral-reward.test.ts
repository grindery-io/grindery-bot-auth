import chai from 'chai';
import {
  mockResponsePath,
  mockUserHandle,
  mockUserName,
  mockUserTelegramID,
  mockWallet,
  mockAccessToken,
  mockTransactionHash,
  mockUserTelegramID1,
  mockTransactionHash1,
  mockUserOpHash,
  mockTransactionHash2,
  mockUserTelegramID2,
  mockResponsePath1,
  mockUserHandle1,
  mockUserName1,
  mockWallet1,
  mockResponsePath2,
  mockUserHandle2,
  mockUserName2,
  mockWallet2,
  mockUserOpHash1,
  mockUserTelegramID3,
  mockResponsePath3,
  mockUserHandle3,
  mockUserName3,
  mockWallet3,
  mockTokenAddress,
  mockChainName,
  getCollectionTransfersMock,
  getCollectionUsersMock,
  getCollectionRewardsMock,
} from './utils';
import Sinon from 'sinon';
import axios from 'axios';

import chaiExclude from 'chai-exclude';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_CHAIN_NAME,
  PATCHWALLET_AUTH_URL,
  PATCHWALLET_RESOLVER_URL,
  PATCHWALLET_TX_STATUS_URL,
  PATCHWALLET_TX_URL,
  TRANSACTION_STATUS,
} from '../utils/constants';
import {
  FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK,
  G1_POLYGON_ADDRESS,
  SOURCE_TG_ID,
} from '../../secrets';
import { handleReferralReward } from '../utils/webhooks/referral-reward';
import * as web3 from '../utils/web3';
import { Collection, Document } from 'mongodb';

chai.use(chaiExclude);

describe('handleReferralReward function', function () {
  let sandbox: Sinon.SinonSandbox;
  let axiosStub;
  let rewardId: string;
  let collectionTransfersMock: Collection<Document>;
  let collectionUsersMock: Collection<Document>;
  let collectionRewardsMock: Collection<Document>;
  let contractStub: { methods: any };
  let getContract;

  beforeEach(async function () {
    collectionTransfersMock = await getCollectionTransfersMock();
    collectionUsersMock = await getCollectionUsersMock();
    collectionRewardsMock = await getCollectionRewardsMock();

    sandbox = Sinon.createSandbox();
    axiosStub = sandbox.stub(axios, 'post').callsFake(async (url: string) => {
      if (url === PATCHWALLET_AUTH_URL) {
        return Promise.resolve({
          data: {
            access_token: mockAccessToken,
          },
        });
      }

      if (url === PATCHWALLET_TX_URL) {
        return Promise.resolve({
          data: {
            txHash: mockTransactionHash,
          },
        });
      }

      if (url === PATCHWALLET_TX_STATUS_URL) {
        return Promise.resolve({
          data: {
            txHash: mockTransactionHash,
            userOpHash: mockUserOpHash,
          },
        });
      }

      if (url === PATCHWALLET_RESOLVER_URL) {
        return Promise.resolve({
          data: {
            users: [{ accountAddress: mockWallet }],
          },
        });
      }

      if (url === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK) {
        return Promise.resolve({
          result: 'success',
        });
      }

      throw new Error('Unexpected URL encountered');
    });

    contractStub = {
      methods: {
        decimals: sandbox.stub().resolves('18'),
        transfer: sandbox.stub().returns({
          encodeABI: sandbox
            .stub()
            .returns(
              '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
            ),
        }),
      },
    };
    contractStub.methods.decimals = sandbox.stub().returns({
      call: sandbox.stub().resolves('18'),
    });
    getContract = () => {
      return contractStub;
    };
    sandbox.stub(web3, 'getContract').callsFake(getContract);

    rewardId = uuidv4();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('No transactions are eligible for a reward', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          patchwallet: mockWallet,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
        },
        {
          patchwallet: mockWallet1,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID,
          recipientTgId: 'anotherRecipient',
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: 'anotherRecipient1',
        },
        {
          transactionHash: mockTransactionHash2,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);
    });

    it('Should return true if No transactions are eligible for a reward', async function () {
      const result = await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(result).to.be.true;
    });

    it('Should not send any tokens if No transactions are eligible for a reward', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not update the reward database if No transactions are eligible for a reward', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(await collectionRewardsMock.find({}).toArray()).to.be.empty;
    });

    it('Should not call FlowXO if No transactions are eligible for a reward', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('The transaction is already rewarded with the same eventId', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          patchwallet: mockWallet1,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
        },
        {
          patchwallet: mockWallet2,
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: rewardId,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash,
          userTelegramID: mockUserTelegramID1,
          status: TRANSACTION_STATUS.SUCCESS,
        },
        {
          eventId: rewardId,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash1,
          userTelegramID: mockUserTelegramID2,
          status: TRANSACTION_STATUS.SUCCESS,
        },
      ]);
    });

    it('Should return true if The transaction is already rewarded with the same eventId', async function () {
      const result = await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(result).to.be.true;
    });

    it('Should not send any tokens if The transaction is already rewarded with the same eventId', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not update the database if The transaction is already rewarded with the same eventId', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash,
            userTelegramID: mockUserTelegramID1,
            status: TRANSACTION_STATUS.SUCCESS,
          },
          {
            eventId: rewardId,
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash1,
            userTelegramID: mockUserTelegramID2,
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO if The transaction is already rewarded with the same eventId', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('The transaction is already rewarded with another eventId', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          patchwallet: mockWallet1,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
        },
        {
          patchwallet: mockWallet2,
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: 'anotherEventId',
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID1,
          parentTransactionHash: mockTransactionHash,
          newUserAddress: mockWallet,
        },
        {
          eventId: 'anotherEventId',
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID2,
          parentTransactionHash: mockTransactionHash1,
          newUserAddress: mockWallet,
        },
      ]);
    });

    it('Should return true if The transaction is already rewarded with another eventId', async function () {
      const result = await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(result).to.be.true;
    });

    it('Should not send any tokens if The transaction is already rewarded with another eventId', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not update the database if The transaction is already rewarded with another eventId', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: 'anotherEventId',
            reason: '2x_reward',
            userTelegramID: mockUserTelegramID1,
            parentTransactionHash: mockTransactionHash,
            newUserAddress: mockWallet,
          },
          {
            eventId: 'anotherEventId',
            reason: '2x_reward',
            userTelegramID: mockUserTelegramID2,
            parentTransactionHash: mockTransactionHash1,
            newUserAddress: mockWallet,
          },
        ]);
    });

    it('Should not call FlowXO if The transaction is already rewarded with another eventId', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('The transaction is already rewarded with no eventId', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          patchwallet: mockWallet1,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
        },
        {
          patchwallet: mockWallet2,
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash,
          newUserAddress: mockWallet,
        },
        {
          userTelegramID: mockUserTelegramID2,
          reason: '2x_reward',
          parentTransactionHash: mockTransactionHash1,
          newUserAddress: mockWallet,
        },
      ]);
    });

    it('Should return true if The transaction is already rewarded with no eventId', async function () {
      const result = await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(result).to.be.true;
    });

    it('Should not send any tokens if The transaction is already rewarded with no eventId', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not update the database if The transaction is already rewarded with no eventId', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            userTelegramID: mockUserTelegramID1,
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash,
            newUserAddress: mockWallet,
          },
          {
            userTelegramID: mockUserTelegramID2,
            reason: '2x_reward',
            parentTransactionHash: mockTransactionHash1,
            newUserAddress: mockWallet,
          },
        ]);
    });

    it('Should not call FlowXO if The transaction is already rewarded with no eventId', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK),
      ).to.be.undefined;
    });
  });

  describe('Reward status are pending at the beginning', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID1,
          dateAdded: new Date(new Date().getTime() - 5),
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: rewardId,
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID1,
          parentTransactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.PENDING,
        },
        {
          eventId: rewardId,
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID1,
          parentTransactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.PENDING,
        },
        {
          eventId: rewardId,
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID2,
          parentTransactionHash: mockTransactionHash1,
          status: TRANSACTION_STATUS.PENDING,
        },
      ]);
    });

    it('Should return true if Reward status are pending at the beginning', async function () {
      const result = await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(result).to.be.true;
    });

    it('Should call the sendTokens function only one time properly if Reward status are pending at the beginning', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
        tokenAddress: mockTokenAddress,
        chainName: mockChainName,
      });

      const sendTokensCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === PATCHWALLET_TX_URL);

      chai.expect(sendTokensCalls.length).to.equal(1);
      chai.expect(sendTokensCalls[0].args[1]).to.deep.equal({
        userId: `grindery:${SOURCE_TG_ID}`,
        chain: mockChainName,
        to: [mockTokenAddress],
        value: ['0x00'],
        data: [
          '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should add success reward in database if Reward status are pending at the beginning', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const rewards = await collectionRewardsMock.find({}).toArray();
      chai.expect(rewards.length).to.equal(3);
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
            newUserAddress: mockWallet,
            userOpHash: null,
          },
          {
            eventId: rewardId,
            reason: '2x_reward',
            userTelegramID: mockUserTelegramID1,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.PENDING,
          },
          {
            eventId: rewardId,
            reason: '2x_reward',
            userTelegramID: mockUserTelegramID2,
            parentTransactionHash: mockTransactionHash1,
            status: TRANSACTION_STATUS.PENDING,
          },
        ]);
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should call FlowXO properly if Reward status are pending at the beginning', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const flowXOCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
      chai.expect(flowXOCalls.length).to.equal(1);

      chai
        .expect(flowXOCalls[0].args[1])
        .excluding(['dateAdded'])
        .to.deep.equal({
          newUserTgId: mockUserTelegramID,
          newUserResponsePath: mockResponsePath,
          newUserUserHandle: mockUserHandle,
          newUserUserName: mockUserName,
          newUserPatchwallet: mockWallet,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          walletAddress: mockWallet1,
          reason: '2x_reward',
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          amount: '50',
          message: 'Referral reward',
          transactionHash: mockTransactionHash,
          parentTransactionHash: mockTransactionHash,
        });
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.lessThanOrEqual(new Date());
    });
  });

  describe('Reward status are failure at the beginning', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);
      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID1,
          dateAdded: new Date(new Date().getTime() - 10),
        },
      ]);

      await collectionRewardsMock.insertMany([
        {
          eventId: rewardId,
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID1,
          parentTransactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.FAILURE,
          newUserAddress: mockWallet,
        },
        {
          eventId: rewardId,
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID1,
          parentTransactionHash: mockTransactionHash,
          status: TRANSACTION_STATUS.FAILURE,
          newUserAddress: mockWallet,
        },
        {
          eventId: rewardId,
          reason: '2x_reward',
          userTelegramID: mockUserTelegramID2,
          parentTransactionHash: mockTransactionHash1,
          status: TRANSACTION_STATUS.FAILURE,
        },
      ]);
    });

    it('Should return true if Reward status are failure at the beginning', async function () {
      const result = await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(result).to.be.true;
    });

    it('Should call the sendTokens function properly if Reward status are failure at the beginning', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const sendTokensCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === PATCHWALLET_TX_URL);

      chai.expect(sendTokensCalls.length).to.equal(1);
      chai.expect(sendTokensCalls[0].args[1]).to.deep.equal({
        userId: `grindery:${SOURCE_TG_ID}`,
        chain: DEFAULT_CHAIN_NAME,
        to: [G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should add success reward in database if Reward status are failure at the beginning', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const rewards = await collectionRewardsMock.find({}).toArray();
      chai.expect(rewards.length).to.equal(3);
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
            newUserAddress: mockWallet,
            userOpHash: null,
          },
          {
            eventId: rewardId,
            reason: '2x_reward',
            userTelegramID: mockUserTelegramID1,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.FAILURE,
            newUserAddress: mockWallet,
          },
          {
            eventId: rewardId,
            reason: '2x_reward',
            userTelegramID: mockUserTelegramID2,
            parentTransactionHash: mockTransactionHash1,
            status: TRANSACTION_STATUS.FAILURE,
          },
        ]);
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should call FlowXO properly if Reward status are failure at the beginning', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const flowXOCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
      chai.expect(flowXOCalls.length).to.equal(1);

      chai
        .expect(flowXOCalls[0].args[1])
        .excluding(['dateAdded'])
        .to.deep.equal({
          newUserTgId: mockUserTelegramID,
          newUserResponsePath: mockResponsePath,
          newUserUserHandle: mockUserHandle,
          newUserUserName: mockUserName,
          newUserPatchwallet: mockWallet,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          walletAddress: mockWallet1,
          reason: '2x_reward',
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          amount: '50',
          message: 'Referral reward',
          transactionHash: mockTransactionHash,
          parentTransactionHash: mockTransactionHash,
        });
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.lessThanOrEqual(new Date());
    });
  });

  describe('Normal process with a new user and transactions to be rewarded', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 5),
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
      ]);
    });

    it('Should return true if transactions to be rewarded', async function () {
      const result = await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(result).to.be.true;
    });

    it('Should call the sendTokens function only once properly if transactions to be rewarded', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const sendTokensCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === PATCHWALLET_TX_URL);

      chai.expect(sendTokensCalls.length).to.equal(1);
      chai.expect(sendTokensCalls[0].args[1]).to.deep.equal({
        userId: `grindery:${SOURCE_TG_ID}`,
        chain: DEFAULT_CHAIN_NAME,
        to: [G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should add success reward in database if transactions to be rewarded', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const rewards = await collectionRewardsMock.find({}).toArray();
      chai.expect(rewards.length).to.equal(1);
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
            newUserAddress: mockWallet,
            userOpHash: null,
          },
        ]);
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should call FlowXO properly if transactions to be rewarded', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const flowXOCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
      chai.expect(flowXOCalls.length).to.equal(1);

      chai
        .expect(flowXOCalls[0].args[1])
        .excluding(['dateAdded'])
        .to.deep.equal({
          newUserTgId: mockUserTelegramID,
          newUserResponsePath: mockResponsePath,
          newUserUserHandle: mockUserHandle,
          newUserUserName: mockUserName,
          newUserPatchwallet: mockWallet,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          walletAddress: mockWallet1,
          reason: '2x_reward',
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          amount: '50',
          message: 'Referral reward',
          transactionHash: mockTransactionHash,
          parentTransactionHash: mockTransactionHash,
        });
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.lessThanOrEqual(new Date());
    });
  });

  describe('Normal process with a new user and transactions to be rewarded but no patchwallet for referent', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 5),
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
      ]);
    });

    it('Should add success reward in database if transactions to be rewarded', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const rewards = await collectionRewardsMock.find({}).toArray();
      chai.expect(rewards.length).to.equal(1);
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
            newUserAddress: mockWallet,
            userOpHash: null,
          },
        ]);
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
    });
  });

  describe('Normal process with a new user and transactions to be rewarded with same hash', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(Date.now() - 5),
        },
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(Date.now() - 5),
        },
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(Date.now() - 20000),
        },
      ]);
    });

    it('Should return true if transactions to be rewarded with same hash', async function () {
      const result = await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(result).to.be.true;
    });

    it('Should call the sendTokens function only once properly if transactions to be rewarded with same hash', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const sendTokensCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === PATCHWALLET_TX_URL);

      chai.expect(sendTokensCalls.length).to.equal(1);
      chai.expect(sendTokensCalls[0].args[1]).to.deep.equal({
        userId: `grindery:${SOURCE_TG_ID}`,
        chain: DEFAULT_CHAIN_NAME,
        to: [G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should add success reward in database if transactions to be rewarded with same hash', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const rewards = await collectionRewardsMock.find({}).toArray();
      chai.expect(rewards.length).to.equal(1);
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
            newUserAddress: mockWallet,
            userOpHash: null,
          },
        ]);
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should call FlowXO properly if transactions to be rewarded with same hash', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const flowXOCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
      chai.expect(flowXOCalls.length).to.equal(1);

      chai
        .expect(flowXOCalls[0].args[1])
        .excluding(['dateAdded'])
        .to.deep.equal({
          newUserTgId: mockUserTelegramID,
          newUserResponsePath: mockResponsePath,
          newUserUserHandle: mockUserHandle,
          newUserUserName: mockUserName,
          newUserPatchwallet: mockWallet,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          walletAddress: mockWallet1,
          reason: '2x_reward',
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          amount: '50',
          message: 'Referral reward',
          transactionHash: mockTransactionHash,
          parentTransactionHash: mockTransactionHash,
        });
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.lessThanOrEqual(new Date());
    });
  });

  describe('Duplicate user in transactions to be rewarded', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 5),
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 5),
        },
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
      ]);
    });

    it('Should return true if duplicate user in transactions to be rewarded', async function () {
      const result = await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(result).to.be.true;
    });

    it('Should call the sendTokens function properly only once if duplicate user in transactions to be rewarded', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const sendTokensCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === PATCHWALLET_TX_URL);

      chai.expect(sendTokensCalls.length).to.equal(1);
      chai.expect(sendTokensCalls[0].args[1]).to.deep.equal({
        userId: `grindery:${SOURCE_TG_ID}`,
        chain: DEFAULT_CHAIN_NAME,
        to: [G1_POLYGON_ADDRESS],
        value: ['0x00'],
        data: [
          '0xa9059cbb000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000002b5e3af16b1880000',
        ],
        delegatecall: 0,
        auth: '',
      });
    });

    it('Should add success reward in database only once if duplicate user in transactions to be rewarded', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const rewards = await collectionRewardsMock.find({}).toArray();
      chai.expect(rewards.length).to.equal(1);
      chai
        .expect(rewards)
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
            newUserAddress: mockWallet,
            userOpHash: null,
          },
        ]);
      chai
        .expect(rewards[0].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai.expect(rewards[0].dateAdded).to.be.lessThanOrEqual(new Date());
    });

    it('Should call FlowXO properly only one time if duplicate user in transactions to be rewarded', async function () {
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      const flowXOCalls = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
      chai.expect(flowXOCalls.length).to.equal(1);

      chai
        .expect(flowXOCalls[0].args[1])
        .excluding(['dateAdded'])
        .to.deep.equal({
          newUserTgId: mockUserTelegramID,
          newUserResponsePath: mockResponsePath,
          newUserUserHandle: mockUserHandle,
          newUserUserName: mockUserName,
          newUserPatchwallet: mockWallet,
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          walletAddress: mockWallet1,
          reason: '2x_reward',
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          amount: '50',
          message: 'Referral reward',
          transactionHash: mockTransactionHash,
          parentTransactionHash: mockTransactionHash,
        });
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
      chai
        .expect(flowXOCalls[0].args[1].dateAdded)
        .to.be.lessThanOrEqual(new Date());
    });
  });

  it('Should return true if there is an error in FlowXO webhook', async function () {
    axiosStub
      .withArgs(FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK)
      .rejects(new Error('Service not available'));

    await collectionUsersMock.insertMany([
      {
        userTelegramID: mockUserTelegramID1,
        responsePath: mockResponsePath1,
        userHandle: mockUserHandle1,
        userName: mockUserName1,
        patchwallet: mockWallet1,
      },
      {
        userTelegramID: mockUserTelegramID2,
        responsePath: mockResponsePath2,
        userHandle: mockUserHandle2,
        userName: mockUserName2,
        patchwallet: mockWallet2,
      },
    ]);
    await collectionTransfersMock.insertMany([
      {
        transactionHash: mockTransactionHash,
        senderTgId: mockUserTelegramID1,
        recipientTgId: mockUserTelegramID,
      },
      {
        transactionHash: mockTransactionHash1,
        senderTgId: mockUserTelegramID2,
        recipientTgId: mockUserTelegramID,
      },
    ]);

    chai.expect(
      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      }),
    ).to.be.true;
  });

  describe('PatchWallet transaction error', function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 5),
        },
      ]);
    });

    it('Should return false if there is an error during the token sending', async function () {
      axiosStub
        .withArgs(PATCHWALLET_TX_URL)
        .rejects(new Error('Service not available'));

      chai.expect(
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        }),
      ).to.be.false;
    });

    it('Should insert reward as pending in the database if there is an error during the token sending', async function () {
      axiosStub
        .withArgs(PATCHWALLET_TX_URL)
        .rejects(new Error('Service not available'));

      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.PENDING,
            newUserAddress: mockWallet,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO webhook if there is an error in the transaction', async function () {
      axiosStub
        .withArgs(PATCHWALLET_TX_URL)
        .rejects(new Error('Service not available'));

      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .filter((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK),
      ).to.be.empty;
    });
  });

  describe('PatchWallet transaction without hash', function () {
    beforeEach(async function () {
      await collectionUsersMock.insertMany([
        {
          userTelegramID: mockUserTelegramID1,
          responsePath: mockResponsePath1,
          userHandle: mockUserHandle1,
          userName: mockUserName1,
          patchwallet: mockWallet1,
        },
        {
          userTelegramID: mockUserTelegramID2,
          responsePath: mockResponsePath2,
          userHandle: mockUserHandle2,
          userName: mockUserName2,
          patchwallet: mockWallet2,
        },
      ]);

      await collectionTransfersMock.insertMany([
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash,
          senderTgId: mockUserTelegramID1,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 10),
        },
        {
          transactionHash: mockTransactionHash1,
          senderTgId: mockUserTelegramID2,
          recipientTgId: mockUserTelegramID,
          dateAdded: new Date(new Date().getTime() - 5),
        },
      ]);
    });

    it('Should return false if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });

      chai.expect(
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        }),
      ).to.be.false;
    });

    it('Should add a pending in the rewards in the database if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });

      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai
        .expect(await collectionRewardsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            parentTransactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.PENDING,
            newUserAddress: mockWallet,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO webhook if there is no hash in PatchWallet response', async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });

      await handleReferralReward({
        eventId: rewardId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
        patchwallet: mockWallet,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .filter((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK),
      ).to.be.empty;
    });
  });

  describe('Get transaction hash via userOpHash if transaction hash is empty first', function () {
    describe('Transaction hash is empty in tx PatchWallet endpoint', async function () {
      beforeEach(async function () {
        axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
        ]);
        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID3,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 5),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
            dateAdded: new Date(new Date().getTime() - 10),
          },
        ]);
      });
      it('Should return false if transaction hash is empty in tx PatchWallet endpoint', async function () {
        const result = await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(result).to.be.false;
      });
      it('Should update reward database with a pending_hash status and userOpHash if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              parentTransactionHash: mockTransactionHash,
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              newUserAddress: mockWallet,
              transactionHash: null,
            },
          ]);
      });
      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });
    describe('Transaction hash is present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
          {
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            userHandle: mockUserHandle3,
            userName: mockUserName3,
            patchwallet: mockWallet3,
          },
        ]);
        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID3,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 5),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
            dateAdded: new Date(new Date().getTime() - 10),
          },
        ]);
        await collectionRewardsMock.insertMany([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash1,
            parentTransactionHash: mockTransactionHash,
          },
        ]);
      });
      it('Should return true if transaction hash is present in PatchWallet status endpoint', async function () {
        const result = await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(result).to.be.true;
      });
      it('Should not send tokens if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });
      it('Should update the database with a success status if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              userOpHash: mockUserOpHash1,
              transactionHash: mockTransactionHash,
              parentTransactionHash: mockTransactionHash,
              newUserAddress: mockWallet,
            },
          ]);
      });
      it('Should call FlowXO webhook properly if transaction hash is present in PatchWallet status endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        const flowXOCalls = axiosStub
          .getCalls()
          .filter((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK);
        chai.expect(flowXOCalls.length).to.equal(1);
        chai
          .expect(flowXOCalls[0].args[1])
          .excluding(['dateAdded'])
          .to.deep.equal({
            newUserTgId: mockUserTelegramID,
            newUserResponsePath: mockResponsePath,
            newUserUserHandle: mockUserHandle,
            newUserUserName: mockUserName,
            newUserPatchwallet: mockWallet,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            transactionHash: mockTransactionHash,
            parentTransactionHash: mockTransactionHash,
          });
        chai
          .expect(flowXOCalls[0].args[1].dateAdded)
          .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
        chai
          .expect(flowXOCalls[0].args[1].dateAdded)
          .to.be.lessThanOrEqual(new Date());
      });
    });
    describe('Transaction hash is not present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
          {
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            userHandle: mockUserHandle3,
            userName: mockUserName3,
            patchwallet: mockWallet3,
          },
        ]);
        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 5),
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID3,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
            dateAdded: new Date(new Date().getTime() - 10),
          },
        ]);
        await collectionRewardsMock.insertMany([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash,
          },
        ]);
        axiosStub.withArgs(PATCHWALLET_TX_STATUS_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });
      it('Should return false if transaction hash is not present in PatchWallet status endpoint', async function () {
        const result = await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(result).to.be.false;
      });
      it('Should not send tokens if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });
      it('Should not update database if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash,
              newUserAddress: mockWallet,
              transactionHash: null,
            },
          ]);
      });
      it('Should not call FlowXO webhook if transaction hash is not present in PatchWallet status endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });
    describe('Error in PatchWallet get status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
          {
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            userHandle: mockUserHandle3,
            userName: mockUserName3,
            patchwallet: mockWallet3,
          },
        ]);
        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID3,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 5),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
            dateAdded: new Date(new Date().getTime() - 10),
          },
        ]);
        await collectionRewardsMock.insertMany([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash,
          },
        ]);
        axiosStub
          .withArgs(PATCHWALLET_TX_STATUS_URL)
          .rejects(new Error('Service not available'));
      });
      it('Should return false if Error in PatchWallet get status endpoint', async function () {
        const result = await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(result).to.be.false;
      });
      it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });
      it('Should not update database if Error in PatchWallet get status endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash,
            },
          ]);
      });
      it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });
    describe('Transaction is set to success without transaction hash if pending_hash without userOpHash', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
          {
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            userHandle: mockUserHandle3,
            userName: mockUserName3,
            patchwallet: mockWallet3,
          },
        ]);
        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID3,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 5),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
            dateAdded: new Date(new Date().getTime() - 10),
          },
        ]);
        await collectionRewardsMock.insertMany([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            parentTransactionHash: mockTransactionHash,
          },
        ]);
      });
      it('Should return true if transaction hash is pending_hash without userOpHash', async function () {
        const result = await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(result).to.be.true;
      });
      it('Should not send tokens if transaction hash is pending_hash without userOpHash', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });
      it('Should update reward database with a success status if transaction hash is pending_hash without userOpHash', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.SUCCESS,
              parentTransactionHash: mockTransactionHash,
              newUserAddress: mockWallet,
              transactionHash: null,
              userOpHash: null,
            },
          ]);
      });
      it('Should not call FlowXO webhook if transaction hash is empty in tx PatchWallet endpoint', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });
    describe('Transaction is considered as failure after 10 min of trying to get status', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertMany([
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            patchwallet: mockWallet1,
          },
          {
            userTelegramID: mockUserTelegramID2,
            responsePath: mockResponsePath2,
            userHandle: mockUserHandle2,
            userName: mockUserName2,
            patchwallet: mockWallet2,
          },
          {
            userTelegramID: mockUserTelegramID3,
            responsePath: mockResponsePath3,
            userHandle: mockUserHandle3,
            userName: mockUserName3,
            patchwallet: mockWallet3,
          },
        ]);
        await collectionTransfersMock.insertMany([
          {
            transactionHash: mockTransactionHash,
            senderTgId: mockUserTelegramID1,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID2,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 10),
          },
          {
            transactionHash: mockTransactionHash2,
            senderTgId: mockUserTelegramID3,
            recipientTgId: mockUserTelegramID,
            dateAdded: new Date(new Date().getTime() - 5),
          },
          {
            transactionHash: mockTransactionHash1,
            senderTgId: mockUserTelegramID1,
            recipientTgId: 'anotherUserId',
            dateAdded: new Date(new Date().getTime() - 10),
          },
        ]);
        await collectionRewardsMock.insertMany([
          {
            eventId: rewardId,
            userTelegramID: mockUserTelegramID1,
            responsePath: mockResponsePath1,
            walletAddress: mockWallet1,
            reason: '2x_reward',
            userHandle: mockUserHandle1,
            userName: mockUserName1,
            amount: '50',
            message: 'Referral reward',
            status: TRANSACTION_STATUS.PENDING_HASH,
            userOpHash: mockUserOpHash,
            parentTransactionHash: mockTransactionHash,
            dateAdded: new Date(Date.now() - 12 * 60 * 1000),
          },
        ]);
        axiosStub.withArgs(PATCHWALLET_TX_STATUS_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });
      it('Should return true after 10 min of trying to get status', async function () {
        const result = await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(result).to.be.true;
      });
      it('Should not send tokens after 10 min of trying to get status', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });
      it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai
          .expect(await collectionRewardsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: rewardId,
              userTelegramID: mockUserTelegramID1,
              responsePath: mockResponsePath1,
              walletAddress: mockWallet1,
              reason: '2x_reward',
              userHandle: mockUserHandle1,
              userName: mockUserName1,
              amount: '50',
              message: 'Referral reward',
              status: TRANSACTION_STATUS.FAILURE,
              userOpHash: mockUserOpHash,
              parentTransactionHash: mockTransactionHash,
              newUserAddress: mockWallet,
              transactionHash: null,
            },
          ]);
      });
      it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
        await handleReferralReward({
          eventId: rewardId,
          userTelegramID: mockUserTelegramID,
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        });
        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_REFERRAL_REWARD_WEBHOOK),
        ).to.be.undefined;
      });
    });
  });
});
