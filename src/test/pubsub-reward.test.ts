import chai from 'chai';
import {
  mockResponsePath,
  mockUserHandle,
  mockUserName,
  mockUserTelegramID,
  mockWallet,
  mockUserTelegramID1,
  patchwalletResolverUrl,
  segmentIdentifyUrl,
  getCollectionUsersMock,
} from './utils';
import { handleNewReward } from '../utils/webhooks/webhook';
import Sinon from 'sinon';
import axios from 'axios';

import chaiExclude from 'chai-exclude';
import { v4 as uuidv4 } from 'uuid';
import { signup_utils } from '../utils/webhooks/signup-reward';
import { referral_utils } from '../utils/webhooks/referral-reward';
import { link_reward_utils } from '../utils/webhooks/link-reward';

chai.use(chaiExclude);

describe('handleReferralReward function', function () {
  let sandbox;
  let axiosStub;
  let eventId;
  let collectionUsersMock;

  beforeEach(async function () {
    collectionUsersMock = await getCollectionUsersMock();

    sandbox = Sinon.createSandbox();
    axiosStub = sandbox.stub(axios, 'post').callsFake(async (url: string) => {
      if (url === patchwalletResolverUrl) {
        return Promise.resolve({
          data: {
            users: [{ accountAddress: mockWallet }],
          },
        });
      }

      if (url === segmentIdentifyUrl) {
        return Promise.resolve({
          result: 'success',
        });
      }

      throw new Error('Unexpected URL encountered');
    });
    sandbox
      .stub(signup_utils, 'handleSignUpReward')
      .callsFake(async function () {
        return true;
      });
    sandbox
      .stub(link_reward_utils, 'handleLinkReward')
      .callsFake(async function () {
        return true;
      });
    sandbox
      .stub(referral_utils, 'handleReferralReward')
      .callsFake(async function () {
        return true;
      });
    eventId = uuidv4();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('Should return true with no new user if user is not new', async function () {
    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
    });

    const result = await handleNewReward({
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
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.true;
  });

  it('Should return false with no new user if signup reward is false', async function () {
    (signup_utils.handleSignUpReward as any).callsFake(async function () {
      return false;
    });

    const result = await handleNewReward({
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
    (signup_utils.handleSignUpReward as any).callsFake(async function () {
      return false;
    });

    let result = await handleNewReward({
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.false;

    (signup_utils.handleSignUpReward as any).callsFake(async function () {
      return true;
    });

    // Restart
    result = await handleNewReward({
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
    (referral_utils.handleReferralReward as any).callsFake(async function () {
      return false;
    });

    chai.expect(
      await handleNewReward({
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
    (referral_utils.handleReferralReward as any).callsFake(async function () {
      return false;
    });

    let result = await handleNewReward({
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    chai.expect(result).to.be.false;
    chai.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;

    (referral_utils.handleReferralReward as any).callsFake(async function () {
      return true;
    });

    result = await handleNewReward({
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
    (link_reward_utils.handleLinkReward as any).callsFake(async function () {
      return false;
    });

    let result = await handleNewReward({
      eventId: eventId,
      userTelegramID: mockUserTelegramID,
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
      referentUserTelegramID: mockUserTelegramID1,
    });

    chai.expect(result).to.be.false;
    chai.expect(await collectionUsersMock.find({}).toArray()).to.be.empty;

    (link_reward_utils.handleLinkReward as any).callsFake(async function () {
      return true;
    });

    result = await handleNewReward({
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
      eventId: eventId,
      userTelegramID: 'newUserTgId',
      responsePath: mockResponsePath,
      userHandle: mockUserHandle,
      userName: mockUserName,
    });

    const segmentIdentityCall = axiosStub
      .getCalls()
      .filter((e) => e.firstArg === segmentIdentifyUrl);

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
      .withArgs(patchwalletResolverUrl)
      .rejects(new Error('Service not available'));

    const result = await handleNewReward({
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
      .withArgs(segmentIdentifyUrl)
      .rejects(new Error('Service not available'));

    const result = await handleNewReward({
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