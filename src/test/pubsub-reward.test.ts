import chai from 'chai';
import {
  mockResponsePath,
  mockUserHandle,
  mockUserName,
  mockUserTelegramID,
  mockWallet,
  mockUserTelegramID1,
  getCollectionUsersMock,
  ContractStub,
  RewardStub,
} from './utils';
import { handleNewReward } from '../webhooks/webhook';
import Sinon from 'sinon';
import axios from 'axios';

import chaiExclude from 'chai-exclude';
import { v4 as uuidv4 } from 'uuid';
import { signup_utils } from '../webhooks/signup-reward';
import { referral_utils } from '../webhooks/referral-reward';
import { link_reward_utils } from '../webhooks/link-reward';
import * as web3 from '../utils/web3';
import { RewardParams } from '../types/webhook.types';
import { Collection, Document } from 'mongodb';
import {
  PATCHWALLET_RESOLVER_URL,
  SEGMENT_IDENTITY_URL,
} from '../utils/constants';

chai.use(chaiExclude);

describe('handleReferralReward function', function () {
  let sandbox: Sinon.SinonSandbox;
  let axiosStub;
  let signUpRewardStub: Sinon.SinonStub<
    [params: RewardParams],
    Promise<boolean>
  >;
  let referralRewardStub: Sinon.SinonStub<
    [params: RewardParams],
    Promise<boolean>
  >;
  let linkRewardStub: Sinon.SinonStub<[params: RewardParams], Promise<boolean>>;
  let eventId: string;
  let collectionUsersMock: Collection<Document>;
  let contractStub: ContractStub;
  let getContract;

  beforeEach(async function () {
    collectionUsersMock = await getCollectionUsersMock();

    sandbox = Sinon.createSandbox();
    axiosStub = sandbox.stub(axios, 'post').callsFake(async (url: string) => {
      if (url === PATCHWALLET_RESOLVER_URL) {
        return Promise.resolve({
          data: {
            users: [{ accountAddress: mockWallet }],
          },
        });
      }

      if (url === SEGMENT_IDENTITY_URL) {
        return Promise.resolve({
          result: 'success',
        });
      }

      throw new Error('Unexpected URL encountered');
    });
    signUpRewardStub = sandbox
      .stub(signup_utils, 'handleSignUpReward')
      .callsFake(async function () {
        return true;
      });
    linkRewardStub = sandbox
      .stub(link_reward_utils, 'handleLinkReward')
      .callsFake(async function () {
        return true;
      });
    referralRewardStub = sandbox
      .stub(referral_utils, 'handleReferralReward')
      .callsFake(async function () {
        return true;
      });

    contractStub = {
      methods: {
        decimals: sandbox.stub().resolves('18'),
        transfer: sandbox.stub().returns({
          encodeABI: sandbox
            .stub()
            .returns(
              '0xa9059cbb00000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000000000000000000064',
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

    eventId = uuidv4();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('Should not call handleSignUpReward if isSignupReward is false', async function () {
    await handleNewReward({
      isSignupReward: false,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(signUpRewardStub.getCalls()).to.be.empty;
  });

  it('Should not call handleReferralReward if isReferralReward is false', async function () {
    await handleNewReward({
      isSignupReward: true,
      isReferralReward: false,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(referralRewardStub.getCalls()).to.be.empty;
  });

  it('Should not call handleLinkReward if isLinkReward is false', async function () {
    await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: false,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(linkRewardStub.getCalls()).to.be.empty;
  });

  it('Should return true with no new user if user is not new', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
    });

    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.true;
    chai
      .expect(await collectionUsersMock.find({}).toArray())
      .excluding(['_id'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
        },
      ]);
  });

  it('Should return true if user is new', async function () {
    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.true;
  });

  it('Should return false with no new user if signup reward is false', async function () {
    (signup_utils.handleSignUpReward as RewardStub).callsFake(
      async function () {
        return false;
      },
    );

    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.false;
    chai.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
  });

  it('Should return true and populate database properly after restart', async function () {
    (signup_utils.handleSignUpReward as RewardStub).resolves(false);

    let result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.false;

    (signup_utils.handleSignUpReward as RewardStub).callsFake(
      async function () {
        return true;
      },
    );

    // Restart
    result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    const users = await collectionUsersMock.find({}).toArray();

    chai.expect(result).to.be.true;
    chai
      .expect(users)
      .excluding(['_id', 'dateAdded'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
          userHandle: mockUserHandle,
          userName: mockUserName,
          responsePath: mockResponsePath,
          patchwallet: mockWallet,
        },
      ]);
  });

  it('Should return false and no new user if referral reward is false', async function () {
    (referral_utils.handleReferralReward as RewardStub).callsFake(
      async function () {
        return false;
      },
    );

    chai.expect(
      await handleNewReward({
        isSignupReward: true,
        isReferralReward: true,
        isLinkReward: true,
        eventId: eventId,
        userTelegramID: mockUserTelegramID,
        responsePath: mockResponsePath,
        userHandle: mockUserHandle,
        userName: mockUserName,
      }),
    ).to.be.false;
    chai.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
  });

  it('Should be able to restart, return true and populate the database properly after restart', async function () {
    (referral_utils.handleReferralReward as RewardStub).callsFake(
      async function () {
        return false;
      },
    );

    let result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.false;
    chai.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;

    (referral_utils.handleReferralReward as RewardStub).callsFake(
      async function () {
        return true;
      },
    );

    result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.true;
    chai
      .expect(await collectionUsersMock.find({}).toArray())
      .excluding(['_id', 'dateAdded'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
          userHandle: mockUserHandle,
          userName: mockUserName,
          responsePath: mockResponsePath,
          patchwallet: mockWallet,
        },
      ]);
  });

  it('Should return true and populate database correctly with referral link', async function () {
    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    chai.expect(result).to.be.true;
    chai
      .expect(await collectionUsersMock.find({}).toArray())
      .excluding(['_id', 'dateAdded'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
          userHandle: mockUserHandle,
          userName: mockUserName,
          responsePath: mockResponsePath,
          patchwallet: mockWallet,
        },
      ]);
  });

  it('Should be able to restart and return true + populate the database properly', async function () {
    (link_reward_utils.handleLinkReward as RewardStub).resolves(false);

    let result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    chai.expect(result).to.be.false;
    chai.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;

    (link_reward_utils.handleLinkReward as RewardStub).callsFake(
      async function () {
        return true;
      },
    );

    result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    chai.expect(result).to.be.true;
    chai
      .expect(await collectionUsersMock.find({}).toArray())
      .excluding(['_id', 'dateAdded'])
      .to.deep.equal([
        {
          userTelegramID: mockUserTelegramID,
          userHandle: mockUserHandle,
          userName: mockUserName,
          responsePath: mockResponsePath,
          patchwallet: mockWallet,
        },
      ]);
  });

  it('Should populate the segment user properly', async function () {
    await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: 'newUserTgId',
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    const segmentIdentityCall = axiosStub
      .getCalls()
      .filter((e) => e.firstArg === SEGMENT_IDENTITY_URL);

    chai
      .expect(segmentIdentityCall[0].args[1])
      .excluding(['timestamp'])
      .to.deep.equal({
        userId: 'newUserTgId',
        traits: {
          responsePath: mockResponsePath,
          userHandle: mockUserHandle,
          userName: mockUserName,
          patchwallet: mockWallet,
        },
      });
    chai
      .expect(segmentIdentityCall[0].args[1].timestamp)
      .to.be.greaterThanOrEqual(new Date(Date.now() - 20000)); // 20 seconds
    chai
      .expect(segmentIdentityCall[0].args[1].timestamp)
      .to.be.lessThanOrEqual(new Date());
  });

  it('Should return false with nothing in the database if PatchWallet address error', async function () {
    axiosStub
      .withArgs(PATCHWALLET_RESOLVER_URL)
      .rejects(new Error('Service not available'));

    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    chai.expect(result).to.be.false;
    chai.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;
  });

  it('Should return true if error in Segment', async function () {
    axiosStub
      .withArgs(SEGMENT_IDENTITY_URL)
      .rejects(new Error('Service not available'));

    const result = await handleNewReward({
      isSignupReward: true,
      isReferralReward: true,
      isLinkReward: true,
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    chai.expect(result).to.be.true;
  });
});
