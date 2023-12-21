import chai from 'chai';
import {
  mockResponsePath,
  mockUserName,
  mockUserTelegramID,
  mockWallet,
  mockAccessToken,
  mockTransactionHash,
  mockUserHandle,
  mockUserOpHash,
  mockChainName,
  mockTokenAddress,
  mockChainId,
  getCollectionUsersMock,
  getCollectionVestingsMock,
  mockWallet1,
  ContractStub,
} from './utils';
import Sinon from 'sinon';
import axios from 'axios';
import chaiExclude from 'chai-exclude';
import {
  G1_TOKEN_SYMBOL,
  HEDGEY_BATCHPLANNER_ADDRESS,
  PATCHWALLET_AUTH_URL,
  PATCHWALLET_TX_STATUS_URL,
  PATCHWALLET_TX_URL,
  SEGMENT_TRACK_URL,
  TRANSACTION_STATUS,
} from '../utils/constants';
import { v4 as uuidv4 } from 'uuid';
import { FLOWXO_NEW_VESTING_WEBHOOK, G1_POLYGON_ADDRESS } from '../../secrets';
import * as web3 from '../utils/web3';
import { Collection, Document } from 'mongodb';
import { handleNewVesting } from '../webhooks/vesting';

chai.use(chaiExclude);

describe('handleNewVesting function', async function () {
  let sandbox: Sinon.SinonSandbox;
  let axiosStub;
  let txId: string;
  let collectionUsersMock: Collection<Document>;
  let collectionVestingsMock: Collection<Document>;
  let contractStub: ContractStub;
  let getContract;

  beforeEach(async function () {
    collectionUsersMock = await getCollectionUsersMock();
    collectionVestingsMock = await getCollectionVestingsMock();

    sandbox = Sinon.createSandbox();
    axiosStub = sandbox.stub(axios, 'post').callsFake(async (url: string) => {
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

      if (url === PATCHWALLET_AUTH_URL) {
        return Promise.resolve({
          data: {
            access_token: mockAccessToken,
          },
        });
      }

      if (url == FLOWXO_NEW_VESTING_WEBHOOK) {
        return Promise.resolve({
          result: 'success',
        });
      }

      if (url == FLOWXO_NEW_VESTING_WEBHOOK) {
        return Promise.resolve({
          result: 'success',
        });
      }

      if (url == SEGMENT_TRACK_URL) {
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

    txId = uuidv4();
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('Normal process to handle a vesting', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should return true', async function () {
      chai.expect(
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [{ recipientAddress: mockWallet, amount: '100' }],
          eventId: txId,
        }),
      ).to.be.true;
    });

    it('Should populate transfers database', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
        chainId: mockChainId,
        tokenAddress: mockTokenAddress,
      });

      const transfers = await collectionVestingsMock.find({}).toArray();

      chai
        .expect(transfers)
        .excluding(['dateAdded', '_id'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: mockTokenAddress,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipients: [
              { recipientAddress: mockWallet, amount: '100' },
              { recipientAddress: mockWallet1, amount: '15' },
            ],
            transactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
            userOpHash: null,
          },
        ]);
      chai.expect(transfers[0].dateAdded).to.be.a('date');
    });

    it('Should call the sendTokens function properly for ERC20 token vesting', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [{ recipientAddress: mockWallet, amount: '100' }],
        eventId: txId,
      });

      chai
        .expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
            .args[1],
        )
        .to.deep.equal({
          userId: `grindery:${mockUserTelegramID}`,
          chain: mockChainName,
          to: [HEDGEY_BATCHPLANNER_ADDRESS],
          value: ['0x00'],
          data: [
            '0xae6253530000000000000000000000001961a23409ca59eedca6a99c97e4087dad752486000000000000000000000000e36bd65609c08cd17b53520293523cf4560533d00000000000000000000000000000000000000000000000056bc75e2d6310000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000100000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d6310000000000000000000000000000000000000000000000000000000000000659200800000000000000000000000000000000000000000000000000000000065920080000000000000000000000000000000000000000000000000000002e24d16b5a9',
          ],
          delegatecall: 0,
          auth: '',
        });
    });

    it('Should populate the segment vesting properly', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
        tokenSymbol: 'USDC',
        tokenAddress: '0xe36BD65609c08Cd17b53520293523CF4560533d2',
        chainId: mockChainId,
      });

      const segmentIdentityCall = axiosStub
        .getCalls()
        .filter((e) => e.firstArg === SEGMENT_TRACK_URL);

      chai
        .expect(segmentIdentityCall[0].args[1])
        .excluding(['timestamp'])
        .to.deep.equal({
          userId: mockUserTelegramID,
          event: 'Vesting',
          properties: {
            chainId: mockChainId,
            tokenSymbol: 'USDC',
            tokenAddress: '0xe36BD65609c08Cd17b53520293523CF4560533d2',
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipients: [
              { recipientAddress: mockWallet, amount: '100' },
              { recipientAddress: mockWallet1, amount: '15' },
            ],
            transactionHash: mockTransactionHash,
            eventId: txId,
          },
        });
    });

    it('Should call FlowXO webhook properly for new transactions', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      const FlowXOCallArgs = axiosStub
        .getCalls()
        .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK).args[1];

      chai
        .expect(FlowXOCallArgs)
        .excluding(['dateAdded'])
        .to.deep.equal({
          senderResponsePath: mockResponsePath,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          transactionHash: mockTransactionHash,
        });
    });
  });

  describe('Normal process to handle a vesting with a float number', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should populate transfers database', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
        chainId: mockChainId,
        tokenAddress: mockTokenAddress,
      });

      const transfers = await collectionVestingsMock.find({}).toArray();

      chai
        .expect(transfers)
        .excluding(['dateAdded', '_id'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: mockTokenAddress,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipients: [
              { recipientAddress: mockWallet, amount: '100' },
              { recipientAddress: mockWallet1, amount: '15' },
            ],
            transactionHash: mockTransactionHash,
            status: TRANSACTION_STATUS.SUCCESS,
            userOpHash: null,
          },
        ]);
      chai.expect(transfers[0].dateAdded).to.be.a('date');
    });

    it('Should call the sendTokens function properly for ERC20 token vesting', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai
        .expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL)
            .args[1],
        )
        .to.deep.equal({
          userId: `grindery:${mockUserTelegramID}`,
          chain: mockChainName,
          to: [HEDGEY_BATCHPLANNER_ADDRESS],
          value: ['0x00'],
          data: [
            '0xae6253530000000000000000000000001961a23409ca59eedca6a99c97e4087dad752486000000000000000000000000e36bd65609c08cd17b53520293523cf4560533d00000000000000000000000000000000000000000000000063bf212b431ec000000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000200000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe50000000000000000000000000000000000000000000000056bc75e2d6310000000000000000000000000000000000000000000000000000000000000659200800000000000000000000000000000000000000000000000000000000065920080000000000000000000000000000000000000000000000000000002e24d16b5a9000000000000000000000000594cfcaa67bc8789d17d39eb5f1dfc7dd95242cd000000000000000000000000000000000000000000000000d02ab486cedc0000000000000000000000000000000000000000000000000000000000006592008000000000000000000000000000000000000000000000000000000000659200800000000000000000000000000000000000000000000000000000006ebec3680d',
          ],
          delegatecall: 0,
          auth: '',
        });
    });
  });

  describe('Transaction is already a success', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionVestingsMock.insertOne({
        eventId: txId,
        status: TRANSACTION_STATUS.SUCCESS,
      });
    });

    it('Should return true and no token sending if vesting is already a success', async function () {
      chai.expect(
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if vesting is already a success', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if vesting is already a success', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai
        .expect(await collectionVestingsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: txId,
            status: TRANSACTION_STATUS.SUCCESS,
          },
        ]);
    });

    it('Should not call FlowXO is already a success', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment is already a success', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL),
      ).to.be.undefined;
    });
  });

  describe('Transaction if is already a failure', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      await collectionVestingsMock.insertOne({
        eventId: txId,
        status: TRANSACTION_STATUS.FAILURE,
      });
    });

    it('Should return true and no token sending if vesting if is already a failure', async function () {
      chai.expect(
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        }),
      ).to.be.true;
    });

    it('Should not send tokens if vesting if is already a failure', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not modify database if vesting if is already a failure', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai
        .expect(await collectionVestingsMock.find({}).toArray())
        .excluding(['_id'])
        .to.deep.equal([
          {
            eventId: txId,
            status: TRANSACTION_STATUS.FAILURE,
          },
        ]);
    });

    it('Should not call FlowXO if is already a failure', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if is already a failure', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL),
      ).to.be.undefined;
    });
  });

  describe('Error in send token request', async function () {
    beforeEach(async function () {
      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
      });

      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });
    });

    it('Should return false if there is an error in the send tokens request', async function () {
      const result = await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(result).to.be.false;
    });

    it('Should not modify vesting status in the database if there is an error in the send tokens request', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai
        .expect(await collectionVestingsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: G1_POLYGON_ADDRESS,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipients: [
              { recipientAddress: mockWallet, amount: '100' },
              { recipientAddress: mockWallet1, amount: '15' },
            ],
            status: TRANSACTION_STATUS.PENDING,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if there is an error in the send tokens request', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if there is an error in the send tokens request', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL),
      ).to.be.undefined;
    });
  });

  it('Should not add new vesting if one with the same eventId already exists', async function () {
    await collectionVestingsMock.insertOne({
      eventId: txId,
    });

    const objectId = (
      await collectionVestingsMock.findOne({
        eventId: txId,
      })
    )._id.toString();

    await collectionUsersMock.insertOne({
      userTelegramID: mockUserTelegramID,
      userName: mockUserName,
      userHandle: mockUserHandle,
      patchwallet: mockWallet,
    });

    await handleNewVesting({
      senderTgId: mockUserTelegramID,
      recipients: [
        { recipientAddress: mockWallet, amount: '100' },
        { recipientAddress: mockWallet1, amount: '15' },
      ],
      eventId: txId,
    });

    chai
      .expect(
        (await collectionVestingsMock.find({}).toArray())[0]._id.toString(),
      )
      .to.equal(objectId);
  });

  describe('Sender is not a user', async function () {
    it('Should return true if sender is not a user', async function () {
      const result = await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(result).to.be.true;
    });

    it('Should not add anything in database if sender is not a user', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(await collectionVestingsMock.find({}).toArray()).to.be.empty;
    });

    it('Should not send tokens if sender is not a user', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
      ).to.be.undefined;
    });

    it('Should not call FlowXO if sender is not a user', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if sender is not a user', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL),
      ).to.be.undefined;
    });
  });

  describe('Error in PatchWallet vesting', async function () {
    beforeEach(async function () {
      axiosStub
        .withArgs(PATCHWALLET_TX_URL)
        .rejects(new Error('Service not available'));

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should return false if error in PatchWallet vesting', async function () {
      const result = await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(result).to.be.false;
    });

    it('Should not modify database if error in PatchWallet vesting', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai
        .expect(await collectionVestingsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: G1_POLYGON_ADDRESS,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipients: [
              { recipientAddress: mockWallet, amount: '100' },
              { recipientAddress: mockWallet1, amount: '15' },
            ],
            status: TRANSACTION_STATUS.PENDING,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if error in PatchWallet vesting', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if error in PatchWallet vesting', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL),
      ).to.be.undefined;
    });
  });

  describe('PatchWallet 470 error', async function () {
    beforeEach(async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).rejects({
        response: {
          status: 470,
        },
      });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should return true if error 470 in PatchWallet vesting', async function () {
      const result = await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(result).to.be.true;
    });

    it('Should complete db status to failure in database if error 470 in PatchWallet vesting', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai
        .expect(await collectionVestingsMock.find({}).toArray())
        .excluding(['dateAdded', '_id'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: G1_POLYGON_ADDRESS,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipients: [
              { recipientAddress: mockWallet, amount: '100' },
              { recipientAddress: mockWallet1, amount: '15' },
            ],
            status: TRANSACTION_STATUS.FAILURE,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if error 470 in PatchWallet vesting', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if error 470 in PatchWallet vesting', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL),
      ).to.be.undefined;
    });
  });

  describe('No hash in PatchWallet vesting', async function () {
    beforeEach(async function () {
      axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
        data: {
          error: 'service non available',
        },
      });

      await collectionUsersMock.insertOne({
        userTelegramID: mockUserTelegramID,
        userName: mockUserName,
        userHandle: mockUserHandle,
        patchwallet: mockWallet,
        responsePath: mockResponsePath,
      });
    });

    it('Should return false if no hash in PatchWallet vesting', async function () {
      const result = await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(result).to.be.false;
    });

    it('Should do no vesting status modification in database if no hash in PatchWallet vesting', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai
        .expect(await collectionVestingsMock.find({}).toArray())
        .excluding(['_id', 'dateAdded'])
        .to.deep.equal([
          {
            eventId: txId,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: G1_POLYGON_ADDRESS,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipients: [
              { recipientAddress: mockWallet, amount: '100' },
              { recipientAddress: mockWallet1, amount: '15' },
            ],
            status: TRANSACTION_STATUS.PENDING,
            transactionHash: null,
            userOpHash: null,
          },
        ]);
    });

    it('Should not call FlowXO if no hash in PatchWallet vesting', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
      ).to.be.undefined;
    });

    it('Should not call Segment if no hash in PatchWallet vesting', async function () {
      await handleNewVesting({
        senderTgId: mockUserTelegramID,
        recipients: [
          { recipientAddress: mockWallet, amount: '100' },
          { recipientAddress: mockWallet1, amount: '15' },
        ],
        eventId: txId,
      });

      chai.expect(
        axiosStub.getCalls().find((e) => e.firstArg === SEGMENT_TRACK_URL),
      ).to.be.undefined;
    });
  });

  describe('Get vesting hash via userOpHash if vesting hash is empty first', async function () {
    describe('Transaction hash is empty in tx PatchWallet endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
          responsePath: mockResponsePath,
        });

        axiosStub.withArgs(PATCHWALLET_TX_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if vesting hash is empty in tx PatchWallet endpoint', async function () {
        const result = await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(result).to.be.false;
      });

      it('Should update reward database with a pending_hash status and userOpHash if vesting hash is empty in tx PatchWallet endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai
          .expect(await collectionVestingsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipients: [
                { recipientAddress: mockWallet, amount: '100' },
                { recipientAddress: mockWallet1, amount: '15' },
              ],
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if vesting hash is empty in tx PatchWallet endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction hash is present in PatchWallet status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
          responsePath: mockResponsePath,
        });

        await collectionVestingsMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });
      });

      it('Should return true if vesting hash is present in PatchWallet status endpoint', async function () {
        const result = await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(result).to.be.true;
      });

      it('Should not send tokens if vesting hash is present in PatchWallet status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update the database with a success status if vesting hash is present in PatchWallet status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai
          .expect(await collectionVestingsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipients: [
                { recipientAddress: mockWallet, amount: '100' },
                { recipientAddress: mockWallet1, amount: '15' },
              ],
              status: TRANSACTION_STATUS.SUCCESS,
              userOpHash: mockUserOpHash,
              transactionHash: mockTransactionHash,
            },
          ]);
      });

      it('Should call FlowXO webhook properly if vesting hash is present in PatchWallet status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        const FlowXOCallArgs = axiosStub
          .getCalls()
          .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK).args[1];

        chai
          .expect(FlowXOCallArgs)
          .excluding(['dateAdded'])
          .to.deep.equal({
            senderResponsePath: mockResponsePath,
            chainId: mockChainId,
            tokenSymbol: G1_TOKEN_SYMBOL,
            tokenAddress: G1_POLYGON_ADDRESS,
            senderTgId: mockUserTelegramID,
            senderWallet: mockWallet,
            senderName: mockUserName,
            senderHandle: mockUserHandle,
            recipients: [
              { recipientAddress: mockWallet, amount: '100' },
              { recipientAddress: mockWallet1, amount: '15' },
            ],
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
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
          responsePath: mockResponsePath,
        });

        await collectionVestingsMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });

        axiosStub.withArgs(PATCHWALLET_TX_STATUS_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return false if vesting hash is not present in PatchWallet status endpoint', async function () {
        const result = await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(result).to.be.false;
      });

      it('Should not send tokens if vesting hash is not present in PatchWallet status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if vesting hash is not present in PatchWallet status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai
          .expect(await collectionVestingsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipients: [
                { recipientAddress: mockWallet, amount: '100' },
                { recipientAddress: mockWallet1, amount: '15' },
              ],
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if vesting hash is not present in PatchWallet status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Error in PatchWallet get status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
          responsePath: mockResponsePath,
        });

        await collectionVestingsMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });

        axiosStub
          .withArgs(PATCHWALLET_TX_STATUS_URL)
          .rejects(new Error('Service not available'));
      });

      it('Should return false if Error in PatchWallet get status endpoint', async function () {
        const result = await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(result).to.be.false;
      });

      it('Should not send tokens if Error in PatchWallet get status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should not update database if Error in PatchWallet get status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai
          .expect(await collectionVestingsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipients: [
                { recipientAddress: mockWallet, amount: '100' },
                { recipientAddress: mockWallet1, amount: '15' },
              ],
              status: TRANSACTION_STATUS.PENDING_HASH,
              userOpHash: mockUserOpHash,
            },
          ]);
      });

      it('Should not call FlowXO webhook if Error in PatchWallet get status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Error 470 in PatchWallet get status endpoint', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
          responsePath: mockResponsePath,
        });

        await collectionVestingsMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          status: TRANSACTION_STATUS.PENDING_HASH,
          userOpHash: mockUserOpHash,
        });

        axiosStub.withArgs(PATCHWALLET_TX_STATUS_URL).rejects({
          response: {
            status: 470,
          },
        });
      });

      it('Should return true if Error 470 in PatchWallet get status endpoint', async function () {
        const result = await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(result).to.be.true;
      });

      it('Should not send tokens if Error 470 in PatchWallet get status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update database with failure status if Error 470 in PatchWallet get status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai
          .expect(await collectionVestingsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipients: [
                { recipientAddress: mockWallet, amount: '100' },
                { recipientAddress: mockWallet1, amount: '15' },
              ],
              status: TRANSACTION_STATUS.FAILURE,
              userOpHash: mockUserOpHash,
              transactionHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if Error 470 in PatchWallet get status endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction is set to success without vesting hash if pending_hash without userOpHash', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
          responsePath: mockResponsePath,
        });

        await collectionVestingsMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          status: TRANSACTION_STATUS.PENDING_HASH,
        });
      });

      it('Should return true if vesting hash is pending_hash without userOpHash', async function () {
        const result = await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(result).to.be.true;
      });

      it('Should not send tokens if vesting hash is pending_hash without userOpHash', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update reward database with a success status if vesting hash is pending_hash without userOpHash', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai
          .expect(await collectionVestingsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipients: [
                { recipientAddress: mockWallet, amount: '100' },
                { recipientAddress: mockWallet1, amount: '15' },
              ],
              status: TRANSACTION_STATUS.SUCCESS,
              transactionHash: null,
              userOpHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook if vesting hash is empty in tx PatchWallet endpoint', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
        ).to.be.undefined;
      });
    });

    describe('Transaction is considered as failure after 10 min of trying to get status', async function () {
      beforeEach(async function () {
        await collectionUsersMock.insertOne({
          userTelegramID: mockUserTelegramID,
          userName: mockUserName,
          userHandle: mockUserHandle,
          patchwallet: mockWallet,
          responsePath: mockResponsePath,
        });

        await collectionVestingsMock.insertOne({
          eventId: txId,
          chainId: mockChainId,
          tokenSymbol: G1_TOKEN_SYMBOL,
          tokenAddress: G1_POLYGON_ADDRESS,
          senderTgId: mockUserTelegramID,
          senderWallet: mockWallet,
          senderName: mockUserName,
          senderHandle: mockUserHandle,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          status: TRANSACTION_STATUS.PENDING_HASH,
          dateAdded: new Date(Date.now() - 12 * 60 * 1000),
        });

        axiosStub.withArgs(PATCHWALLET_TX_STATUS_URL).resolves({
          data: {
            txHash: '',
            userOpHash: mockUserOpHash,
          },
        });
      });

      it('Should return true after 10 min of trying to get status', async function () {
        const result = await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(result).to.be.true;
      });

      it('Should not send tokens after 10 min of trying to get status', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub.getCalls().find((e) => e.firstArg === PATCHWALLET_TX_URL),
        ).to.be.undefined;
      });

      it('Should update reward database with a failure status after 10 min of trying to get status', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai
          .expect(await collectionVestingsMock.find({}).toArray())
          .excluding(['_id', 'dateAdded'])
          .to.deep.equal([
            {
              eventId: txId,
              chainId: mockChainId,
              tokenSymbol: G1_TOKEN_SYMBOL,
              tokenAddress: G1_POLYGON_ADDRESS,
              senderTgId: mockUserTelegramID,
              senderWallet: mockWallet,
              senderName: mockUserName,
              senderHandle: mockUserHandle,
              recipients: [
                { recipientAddress: mockWallet, amount: '100' },
                { recipientAddress: mockWallet1, amount: '15' },
              ],
              status: TRANSACTION_STATUS.FAILURE,
              transactionHash: null,
              userOpHash: null,
            },
          ]);
      });

      it('Should not call FlowXO webhook after 10 min of trying to get status', async function () {
        await handleNewVesting({
          senderTgId: mockUserTelegramID,
          recipients: [
            { recipientAddress: mockWallet, amount: '100' },
            { recipientAddress: mockWallet1, amount: '15' },
          ],
          eventId: txId,
        });

        chai.expect(
          axiosStub
            .getCalls()
            .find((e) => e.firstArg === FLOWXO_NEW_VESTING_WEBHOOK),
        ).to.be.undefined;
      });
    });
  });
});
