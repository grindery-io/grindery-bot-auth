import { expect } from 'chai';
import {
  isolatedRewardValidator,
  newRewardValidator,
  newTransactionBatchValidator,
  newTransactionValidator,
  swapValidator,
} from '../../validators/webhooks.validator';
import { validateResult } from '../../validators/utils';
import { mockTokenAddress, mockWallet, mockWallet1 } from '../utils';

const NUMBER_PARAMETER_TEST_SWAP = swapValidator.length - 1;
const NUMBER_PARAMETER_TEST_TX = newTransactionValidator.length - 1;
const NUMBER_PARAMETER_TEST_TX_BATCH = newTransactionBatchValidator.length - 2;
const NUMBER_PARAMETER_TEST_REWARD = newRewardValidator.length - 1;
const NUMBER_PARAMETER_TEST_ISOLATED_REWARD =
  isolatedRewardValidator.length - 1;

describe('Webhook validators', function () {
  describe('New Reward Validator', function () {
    const validParams = {
      event: 'new_reward',
      params: {
        userTelegramID: '12345',
        responsePath: '/path',
        userHandle: 'handle123',
        userName: 'JohnDoe',
        isSignupReward: true,
        isReferralReward: false,
        isLinkReward: true,
        delegatecall: '1',
        tokenAddress: mockTokenAddress,
        chainName: 'ETH',
        referentUserTelegramID: '67890',
        chainId: 'eip155:59144',
      },
    };

    const invalidParams = {
      event: 'invalid_event',
      params: {
        userTelegramID: 12345,
        referentUserTelegramID: 12345,
        responsePath: 123,
        userHandle: true,
        userName: { name: 'JohnDoe' },
        isSignupReward: 'rue',
        isReferralReward: 'alse',
        isLinkReward: 'rue',
        delegatecall: 2,
        tokenAddress: 'invalid_address',
        chainName: 123,
        chainId: 'eip155:9999',
      },
    };

    it('Should pass with valid params', async function () {
      const req = { body: validParams };
      await Promise.all(
        newRewardValidator.map((middleware) => middleware(req, {}, () => {})),
      );
      expect(validateResult(req)).to.be.empty;
    });

    it('Should fail with invalid params', async function () {
      const req = { body: invalidParams };
      await Promise.all(
        newRewardValidator.map((middleware) => middleware(req, {}, () => {})),
      );

      expect(validateResult(req).length).to.equal(NUMBER_PARAMETER_TEST_REWARD);

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 'invalid_event',
          msg: 'Invalid event type',
          path: 'event',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'params.userTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.userTelegramID',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'params.referentUserTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.referentUserTelegramID',
          location: 'body',
        },
        {
          type: 'field',
          value: 'rue',
          msg: 'isSignupReward must be a boolean',
          path: 'params.isSignupReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 'alse',
          msg: 'isReferralReward must be a boolean',
          path: 'params.isReferralReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 'rue',
          msg: 'isLinkReward must be a boolean',
          path: 'params.isLinkReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 2,
          msg: 'delegatecall must be either 0 or 1',
          path: 'params.delegatecall',
          location: 'body',
        },
        {
          type: 'field',
          value: 'invalid_address',
          msg: 'tokenAddress must be a valid address',
          path: 'params.tokenAddress',
          location: 'body',
        },
        {
          type: 'field',
          value: 'eip155:9999',
          msg: 'params.chainId must be a valid and supported EIP155 chain ID',
          path: 'params.chainId',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'responsePath must be a string',
          path: 'params.responsePath',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'userHandle must be a string',
          path: 'params.userHandle',
          location: 'body',
        },
        {
          type: 'field',
          value: { name: 'JohnDoe' },
          msg: 'userName must be a string',
          path: 'params.userName',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'chainName must be a string',
          path: 'params.chainName',
          location: 'body',
        },
      ]);
    });
  });

  describe('New Transaction Validator', function () {
    const validParams = {
      event: 'new_transaction',
      params: {
        senderTgId: '12345',
        recipientTgId: '67890',
        amount: '100',
        delegatecall: '1',
        tokenAddress: mockTokenAddress,
        chainName: 'ETH',
        message: 'Transaction message',
        tokenSymbol: 'TKN',
        chainId: 'eip155:59144',
      },
    };

    const invalidParams = {
      event: 'invalid_event',
      params: {
        senderTgId: 12345,
        recipientTgId: 67890,
        amount: '-10',
        delegatecall: 2,
        tokenAddress: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3505',
        chainName: 123,
        message: 123,
        tokenSymbol: true,
        chainId: 'eip155:9999',
      },
    };

    it('Should pass with valid params', async function () {
      const req = { body: validParams };
      await Promise.all(
        newTransactionValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );
      expect(validateResult(req)).to.be.empty;
    });

    it('Should fail with invalid params', async function () {
      const req = { body: invalidParams };
      await Promise.all(
        newTransactionValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );

      expect(validateResult(req).length).to.equal(NUMBER_PARAMETER_TEST_TX);

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 'invalid_event',
          msg: 'Invalid event type',
          path: 'event',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'params.senderTgId must be a string representing a 64-bit little-endian number',
          path: 'params.senderTgId',
          location: 'body',
        },
        {
          type: 'field',
          value: 67890,
          msg: 'params.recipientTgId must be a string representing a 64-bit little-endian number',
          path: 'params.recipientTgId',
          location: 'body',
        },
        {
          type: 'field',
          value: '-10',
          msg: 'Invalid amount',
          path: 'params.amount',
          location: 'body',
        },
        {
          type: 'field',
          value: 2,
          msg: 'delegatecall must be either 0 or 1',
          path: 'params.delegatecall',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3505',
          msg: 'tokenAddress must be a valid address',
          path: 'params.tokenAddress',
          location: 'body',
        },
        {
          type: 'field',
          value: 'eip155:9999',
          msg: 'params.chainId must be a valid and supported EIP155 chain ID',
          path: 'params.chainId',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'chainName must be a string',
          path: 'params.chainName',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'message must be a string',
          path: 'params.message',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'tokenSymbol must be a string',
          path: 'params.tokenSymbol',
          location: 'body',
        },
      ]);
    });
  });

  describe('New Transaction Batch Validator', function () {
    const validParams = {
      event: 'new_transaction_batch',
      params: [
        {
          senderTgId: '12345',
          recipientTgId: '67890',
          amount: '100',
          delegatecall: '1',
          tokenAddress: mockTokenAddress,
          chainName: 'ETH',
          message: 'Transaction message',
          tokenSymbol: 'TKN',
          chainId: 'eip155:59144',
        },
      ],
    };

    const invalidParams = {
      event: 'invalid_event',
      params: [
        {
          senderTgId: 12345,
          recipientTgId: 67890,
          amount: '-10',
          delegatecall: 2,
          tokenAddress: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3505',
          chainName: 123,
          message: 123,
          tokenSymbol: true,
          chainId: 'eip155:9999',
        },
      ],
    };

    it('Should pass with valid params', async function () {
      const req = { body: validParams };
      await Promise.all(
        newTransactionBatchValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );
      expect(validateResult(req)).to.be.empty;
    });

    it('Should fail with invalid params', async function () {
      const req = { body: invalidParams };
      await Promise.all(
        newTransactionBatchValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );

      expect(validateResult(req).length).to.equal(
        NUMBER_PARAMETER_TEST_TX_BATCH,
      );

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 'invalid_event',
          msg: 'Invalid event type',
          path: 'event',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'params.*.senderTgId must be a string representing a 64-bit little-endian number',
          path: 'params[0].senderTgId',
          location: 'body',
        },
        {
          type: 'field',
          value: 67890,
          msg: 'recipientTgId must be a string',
          path: 'params[0].recipientTgId',
          location: 'body',
        },
        {
          type: 'field',
          value: '-10',
          msg: 'Invalid amount',
          path: 'params[0].amount',
          location: 'body',
        },
        {
          type: 'field',
          value: 2,
          msg: 'delegatecall must be either 0 or 1',
          path: 'params[0].delegatecall',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3505',
          msg: 'tokenAddress must be a valid address',
          path: 'params[0].tokenAddress',
          location: 'body',
        },
        {
          type: 'field',
          value: 'eip155:9999',
          msg: 'chainId must be a valid and supported chain ID',
          path: 'params[0].chainId',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'chainName must be a string',
          path: 'params[0].chainName',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'message must be a string',
          path: 'params[0].message',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'tokenSymbol must be a string',
          path: 'params[0].tokenSymbol',
          location: 'body',
        },
      ]);
    });
  });

  describe('Swap Validator', function () {
    const validParams = {
      event: 'swap',
      params: {
        value: '100',
        userTelegramID: '12345',
        to: mockWallet,
        data: 'valid_data',
        tokenIn: mockTokenAddress,
        amountIn: '10',
        tokenOut: mockTokenAddress,
        amountOut: '20',
        priceImpact: '1.5',
        gas: '1000',
        from: mockWallet1,
        tokenInSymbol: 'TKN_IN',
        tokenOutSymbol: 'TKN_OUT',
        chainId: 'eip155:59144',
        chainIn: 'eip155:59144',
        chainOut: 'eip155:59144',
        chainName: 'ETH',
        amount: '50',
        senderTgId: '67890',
        delegatecall: 1,
      },
    };

    const invalidParams = {
      event: 'invalid_event',
      params: {
        value: 100,
        userTelegramID: 12345,
        to: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        data: 123,
        tokenIn: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        amountIn: '-10',
        tokenOut: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        amountOut: '-20',
        priceImpact: 1.5,
        gas: 1000,
        from: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        tokenInSymbol: true,
        tokenOutSymbol: 123,
        chainId: 'eip155:9999',
        chainIn: 'eip155:9999',
        chainOut: 'eip155:9999',
        chainName: 123,
        amount: '-50',
        senderTgId: true,
        delegatecall: 2,
      },
    };

    const realParams = {
      event: 'swap',
      params: {
        userTelegramID: '66670057',
        to: '0x38147794FF247e5Fc179eDbAE6C37fff88f68C52',
        data: '0x8fd8d1bbf5613ee438e628242fc75eb6a62183c4508398306de69595cca4b61b98c4246f000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000006095ea7b3010001ffffffffffc2132d05d31c914a87c6611c10748aeb04b58e8f19198595a30283ffffffff836352a56caadc4f1e25cd6c75970fa768a3304e649bd3b227018302ffffffff036675a323dedb77822fcf39eaa9d682f6abe72555ddcd52200103ffffffffff037e7d64d987cab6eed08a191c4c2459daf2f8ed0b6e7a43a3010304ffffffff037e7d64d987cab6eed08a191c4c2459daf2f8ed0b241c59120103ffffffffffff7e7d64d987cab6eed08a191c4c2459daf2f8ed0b000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000088000000000000000000000000000000000000000000000000000000000000000200000000000000000000000006352a56caadc4f1e25cd6c75970fa768a3304e64000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000006e490411a320000000000000000000000006d8e9bd8f845f51a224e216b6dd25d5e593d8dd3000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001c0000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f0000000000000000000000000b3f868e0be5597d5db7feb59e1cadbb0fdda50a000000000000000000000000f19144bc9b66bd9b999167b41ccb17d473419d1d000000000000000000000000b7456c6085009a0721335b925f8aeccbd4a2815f00000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000c4e0d1534b4f14a0000000000000000000000000000000000000000000000000caf79b192b542a5000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000140000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000018000000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000064cac460ee80000000000000003b6d0340f19144bc9b66bd9b999167b41ccb17d473419d1d000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f0000000000000000000000006d8e9bd8f845f51a224e216b6dd25d5e593d8dd300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000648a6a1e850000000000000000000000000b3f868e0be5597d5db7feb59e1cadbb0fdda50a000000000000000000000000353c1f0bc78fbbc245b3c93ef77b1dcc5b77d2a00000000000000000000000000000000000000000000000000caf79b192b542a500000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000001a49f8654220000000000000000000000000b3f868e0be5597d5db7feb59e1cadbb0fdda50a00000000000000000000000000000001000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000080000000000000000000000000000000000000000000000000000000000000004400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000064d1660f990000000000000000000000000b3f868e0be5597d5db7feb59e1cadbb0fdda50a000000000000000000000000b7456c6085009a0721335b925f8aeccbd4a2815f000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000c4e0d1534b4f14',
        value: '0',
        tokenIn: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f',
        amountIn: '1000000',
        tokenOut: '0x0b3f868e0be5597d5db7feb59e1cadbb0fdda50a',
        amountOut: '914083052957024933',
        gas: '221648',
        priceImpact: '0',
        chainId: 'eip155:137',
        chainIn: 'eip155:137',
        chainOut: 'eip155:137',
        tokenInSymbol: 'USDT',
        tokenOutSymbol: 'SUSHI',
        delegatecall: 1,
      },
    };

    it('Should pass with valid params', async function () {
      const req = { body: validParams };
      await Promise.all(
        swapValidator.map((middleware) => middleware(req, {}, () => {})),
      );
      expect(validateResult(req)).to.be.empty;
    });

    it('Should pass with real data', async function () {
      const req = { body: realParams };
      await Promise.all(
        swapValidator.map((middleware) => middleware(req, {}, () => {})),
      );
      expect(validateResult(req)).to.be.empty;
    });

    it('Should fail with invalid params', async function () {
      const req = { body: invalidParams };
      await Promise.all(
        swapValidator.map((middleware) => middleware(req, {}, () => {})),
      );

      expect(validateResult(req).length).to.equal(NUMBER_PARAMETER_TEST_SWAP);

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 'invalid_event',
          msg: 'Invalid event type',
          path: 'event',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'params.userTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.userTelegramID',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'to must be a valid address',
          path: 'params.to',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'tokenIn must be a valid address',
          path: 'params.tokenIn',
          location: 'body',
        },
        {
          type: 'field',
          value: '-10',
          msg: 'Invalid amount',
          path: 'params.amountIn',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'tokenOut must be a valid address',
          path: 'params.tokenOut',
          location: 'body',
        },
        {
          type: 'field',
          value: '-20',
          msg: 'Invalid amount',
          path: 'params.amountOut',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'from must be a valid address',
          path: 'params.from',
          location: 'body',
        },
        {
          type: 'field',
          value: 'eip155:9999',
          msg: 'params.chainId must be a valid and supported EIP155 chain ID',
          path: 'params.chainId',
          location: 'body',
        },
        {
          type: 'field',
          value: 'eip155:9999',
          msg: 'params.chainIn must be a valid and supported EIP155 chain ID',
          path: 'params.chainIn',
          location: 'body',
        },
        {
          type: 'field',
          value: 'eip155:9999',
          msg: 'params.chainOut must be a valid and supported EIP155 chain ID',
          path: 'params.chainOut',
          location: 'body',
        },
        {
          type: 'field',
          value: '-50',
          msg: 'Invalid amount',
          path: 'params.amount',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'params.senderTgId must be a string representing a 64-bit little-endian number',
          path: 'params.senderTgId',
          location: 'body',
        },
        {
          type: 'field',
          value: 2,
          msg: 'delegatecall must be either 0 or 1',
          path: 'params.delegatecall',
          location: 'body',
        },
        {
          type: 'field',
          value: 100,
          msg: 'value must be a string',
          path: 'params.value',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'data must be a string',
          path: 'params.data',
          location: 'body',
        },
        {
          type: 'field',
          value: 1.5,
          msg: 'priceImpact must be a string',
          path: 'params.priceImpact',
          location: 'body',
        },
        {
          type: 'field',
          value: 1000,
          msg: 'gas must be a string',
          path: 'params.gas',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'tokenInSymbol must be a string',
          path: 'params.tokenInSymbol',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'tokenOutSymbol must be a string',
          path: 'params.tokenOutSymbol',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'chainName must be a string',
          path: 'params.chainName',
          location: 'body',
        },
      ]);
    });
  });

  describe('Isolated Reward Validator', function () {
    const validParams = {
      event: 'isolated_reward',
      params: {
        userTelegramID: '12345',
        responsePath: '/path',
        userHandle: 'handle123',
        userName: 'JohnDoe',
        patchwallet: mockWallet,
        reason: 'Some reason',
        message: 'Reward message',
        amount: '50',
        tokenAddress: mockTokenAddress,
        chainName: 'ETH',
        referentUserTelegramID: '67890',
        isSignupReward: true,
        isReferralReward: false,
        isLinkReward: true,
        delegatecall: 1,
        chainId: 'eip155:59144',
      },
    };

    const invalidParams = {
      event: 'invalid_event',
      params: {
        userTelegramID: 12345,
        responsePath: 123,
        userHandle: true,
        userName: { name: 'JohnDoe' },
        patchwallet: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        reason: 123,
        message: 123,
        amount: '-50',
        tokenAddress: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
        chainName: 123,
        referentUserTelegramID: 67890,
        isSignupReward: 'rue',
        isReferralReward: 'alse',
        isLinkReward: 'rue',
        delegatecall: 2,
        chainId: 'eip155:9999',
      },
    };

    it('Should pass with valid params', async function () {
      const req = { body: validParams };
      await Promise.all(
        isolatedRewardValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );
      expect(validateResult(req)).to.be.empty;
    });

    it('Should fail with invalid params', async function () {
      const req = { body: invalidParams };
      await Promise.all(
        isolatedRewardValidator.map((middleware) =>
          middleware(req, {}, () => {}),
        ),
      );

      expect(validateResult(req).length).to.equal(
        NUMBER_PARAMETER_TEST_ISOLATED_REWARD,
      );

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 'invalid_event',
          msg: 'Invalid event type',
          path: 'event',
          location: 'body',
        },
        {
          type: 'field',
          value: 12345,
          msg: 'params.userTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.userTelegramID',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'patchwallet must be a valid address',
          path: 'params.patchwallet',
          location: 'body',
        },
        {
          type: 'field',
          value: '-50',
          msg: 'Invalid amount',
          path: 'params.amount',
          location: 'body',
        },
        {
          type: 'field',
          value: '0x105E9152e3d4F5486f2953eF6578f7e25c27C3501',
          msg: 'tokenAddress must be a valid address',
          path: 'params.tokenAddress',
          location: 'body',
        },
        {
          type: 'field',
          value: 67890,
          msg: 'params.referentUserTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.referentUserTelegramID',
          location: 'body',
        },
        {
          type: 'field',
          value: 'rue',
          msg: 'isSignupReward must be a boolean',
          path: 'params.isSignupReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 'alse',
          msg: 'isReferralReward must be a boolean',
          path: 'params.isReferralReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 'rue',
          msg: 'isLinkReward must be a boolean',
          path: 'params.isLinkReward',
          location: 'body',
        },
        {
          type: 'field',
          value: 2,
          msg: 'delegatecall must be either 0 or 1',
          path: 'params.delegatecall',
          location: 'body',
        },
        {
          type: 'field',
          value: 'eip155:9999',
          msg: 'params.chainId must be a valid and supported EIP155 chain ID',
          path: 'params.chainId',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'responsePath must be a string',
          path: 'params.responsePath',
          location: 'body',
        },
        {
          type: 'field',
          value: true,
          msg: 'userHandle must be a string',
          path: 'params.userHandle',
          location: 'body',
        },
        {
          type: 'field',
          value: { name: 'JohnDoe' },
          msg: 'userName must be a string',
          path: 'params.userName',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'reason must be a string',
          path: 'params.reason',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'message must be a string',
          path: 'params.message',
          location: 'body',
        },
        {
          type: 'field',
          value: 123,
          msg: 'chainName must be a string',
          path: 'params.chainName',
          location: 'body',
        },
      ]);
    });
  });
});
