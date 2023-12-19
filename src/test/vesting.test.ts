import chai from 'chai';
import { getData, getPlans } from '../utils/vesting';
import { mockTokenAddress, mockWallet } from './utils';
import { HedgeyPlanParams } from '../types/hedgey.types';
import { DEFAULT_CHAIN_ID, IDO_START_DATE } from '../utils/constants';
import Sinon from 'sinon';
import * as web3 from '../utils/web3';

describe('Vesting functions', async function () {
  let sandbox: Sinon.SinonSandbox;
  let contractStub: { methods: any };
  let getContract;

  beforeEach(async function () {
    sandbox = Sinon.createSandbox();

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
  });

  afterEach(function () {
    sandbox.restore();
  });

  describe('getPlans function', async function () {
    const recipients = [
      {
        recipientAddress: '0xRecipient1',
        amount: '100',
      },
      {
        recipientAddress: '0xRecipient2',
        amount: '200',
      },
    ];

    it('Should correctly calculate the totalAmount', async function () {
      const result = await getPlans(recipients);
      const expectedTotalAmount = '300000000000000000000'; // Sum of 100 and 200
      chai.expect(result.totalAmount).to.equal(expectedTotalAmount);
    });

    it('Should create plans with correct parameters for each recipient', async function () {
      const result = await getPlans(recipients);
      chai.expect(result.plans).to.have.lengthOf(recipients.length);

      chai.expect(result).to.deep.equal({
        totalAmount: '300000000000000000000',
        plans: [
          [
            '0xRecipient1',
            '100000000000000000000',
            Math.round(IDO_START_DATE.getTime() / 1000),
            Math.round(IDO_START_DATE.getTime() / 1000),
            Math.ceil(Number('100000000000000000000') / 31536000).toString(),
          ],
          [
            '0xRecipient2',
            '200000000000000000000',
            Math.round(IDO_START_DATE.getTime() / 1000),
            Math.round(IDO_START_DATE.getTime() / 1000),
            Math.ceil(Number('200000000000000000000') / 31536000).toString(),
          ],
        ],
      });
    });
  });

  describe('getData function', function () {
    const tokenAddress = mockTokenAddress;
    const totalAmount = '1000000';
    const plans = [
      [mockWallet, '100000', 1639448400, 1639448400, '25000'],
    ] as HedgeyPlanParams[];

    it('Should return data for vesting when useVesting is true', async function () {
      const useVesting = true;
      const result = await getData(
        useVesting,
        DEFAULT_CHAIN_ID,
        tokenAddress,
        totalAmount,
        plans,
      );

      chai
        .expect(result)
        .to.deep.equal(
          '0x94d37b5a0000000000000000000000002cde9919e81b20b4b33dd562a48a84b54c48f00c000000000000000000000000e36bd65609c08cd17b53520293523cf4560533d000000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006ef802abd3108411afe86656c9a369946aff590d00000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000100000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe500000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000061b7ff500000000000000000000000000000000000000000000000000000000061b7ff5000000000000000000000000000000000000000000000000000000000000061a8',
        );
    });

    it('Should return data for locking when useVesting is false', async function () {
      const useVesting = false;
      const result = await getData(
        useVesting,
        DEFAULT_CHAIN_ID,
        tokenAddress,
        totalAmount,
        plans,
      );

      chai
        .expect(result)
        .to.deep.equal(
          '0xae6253530000000000000000000000001961a23409ca59eedca6a99c97e4087dad752486000000000000000000000000e36bd65609c08cd17b53520293523cf4560533d000000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000000c000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000005000000000000000000000000000000000000000000000000000000000000000100000000000000000000000095222290dd7278aa3ddd389cc1e1d165cc4bafe500000000000000000000000000000000000000000000000000000000000186a00000000000000000000000000000000000000000000000000000000061b7ff500000000000000000000000000000000000000000000000000000000061b7ff5000000000000000000000000000000000000000000000000000000000000061a8',
        );
    });
  });
});
