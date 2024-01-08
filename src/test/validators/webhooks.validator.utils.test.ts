import { expect } from 'chai';
import {
  validateChainID,
  validateResult,
  validateUserTelegramID,
} from '../../validators/utils';
import { CHAIN_MAPPING } from '../../utils/chains';

describe('Webhook validator utils', async function () {
  describe('validateUserTelegramID function', async function () {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockRequest = (value: any) => ({
      body: {
        params: {
          userTelegramID: value,
        },
      },
    });

    it('should validate userTelegramID correctly when it is a valid user ID as string', async function () {
      const userIds = [
        '6175053757',
        '5113589246',
        '5187014279',
        '2074945217',
        '6204624638',
        '5829303669',
        '5866002866',
        '5015274944',
        '5929081775',
        '1652911558',
        '1696490709',
        '1838765561',
        '5434363584',
        '5000418861',
        '5582190332',
        '1343115693',
        '5634434425',
        '1553816371',
        '5557160897',
        '1648718110',
        '5615394828',
        '5528310884',
        '5340720350',
        '5441957203',
        '1951161250',
        '691030271',
        '5582609945',
        '6517588026',
        '5484554724',
        '5529499291',
        '5580380153',
        '6696274329',
        '6529345212',
        '1698212051',
        '6517366518',
        '1574174783',
        '1153134395',
        '1225570899',
        '5598871444',
        '1209782486',
      ];

      for (const userId of userIds) {
        const validateFunction = validateUserTelegramID(
          'params.userTelegramID',
          false,
        );

        const req = mockRequest(userId);

        await validateFunction(req, {}, () => {});

        expect(validateResult(req)).to.be.empty;
      }
    });

    it('Should throw an error when value is an Ethereum address', async function () {
      const validateFunction = validateUserTelegramID(
        'params.userTelegramID',
        false,
      );

      const req = mockRequest('0xfFEE087852cb4898e6c3532E776e68BC68b1143B');

      await validateFunction(req, {}, () => {});

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: '0xfFEE087852cb4898e6c3532E776e68BC68b1143B',
          msg: 'params.userTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.userTelegramID',
          location: 'body',
        },
      ]);
    });

    it('should validate userTelegramID correctly when it is a number', async function () {
      const validateFunction = validateUserTelegramID(
        'params.userTelegramID',
        false,
      );

      const req = mockRequest(5113589246);

      await validateFunction(req, {}, () => {});

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 5113589246,
          msg: 'params.userTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.userTelegramID',
          location: 'body',
        },
      ]);
    });

    it('Should throw an error when value is an empty string', async function () {
      const validateFunction = validateUserTelegramID(
        'params.userTelegramID',
        false,
      );

      const req = mockRequest('');

      await validateFunction(req, {}, () => {});

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: '',
          msg: 'params.userTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.userTelegramID',
          location: 'body',
        },
      ]);
    });

    it('Should throw an error when value is not a string or number', async function () {
      const validateFunction = validateUserTelegramID(
        'params.userTelegramID',
        false,
      );

      const req = mockRequest({ userTelegramID: 'invalidData' }); // For example, an object instead of a string or number

      await validateFunction(req, {}, () => {});

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: { userTelegramID: 'invalidData' },
          msg: 'params.userTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.userTelegramID',
          location: 'body',
        },
      ]);
    });

    it('Should throw an error when value is null', async function () {
      const validateFunction = validateUserTelegramID(
        'params.userTelegramID',
        false,
      );

      const req = mockRequest(null);

      await validateFunction(req, {}, () => {});

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: null,
          msg: 'params.userTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.userTelegramID',
          location: 'body',
        },
      ]);
    });

    it('Should throw an error when value is a boolean', async function () {
      const validateFunction = validateUserTelegramID(
        'params.userTelegramID',
        false,
      );

      const req = mockRequest(true); // or false

      await validateFunction(req, {}, () => {});

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: true, // or false
          msg: 'params.userTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.userTelegramID',
          location: 'body',
        },
      ]);
    });

    it('Should throw an error when value is a non-hexadecimal string', async function () {
      const validateFunction = validateUserTelegramID(
        'params.userTelegramID',
        false,
      );

      const req = mockRequest('notahexadecimalstring');

      await validateFunction(req, {}, () => {});

      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: 'notahexadecimalstring',
          msg: 'params.userTelegramID must be a string representing a 64-bit little-endian number',
          path: 'params.userTelegramID',
          location: 'body',
        },
      ]);
    });
  });

  describe('validateChainID function', async function () {
    let validChainIds: any, mockRequest: any;

    beforeEach(async function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockRequest = (value: any) => ({
        body: {
          params: {
            chainId: value,
          },
        },
      });

      validChainIds = Object.keys(CHAIN_MAPPING);
    });

    it('should validate chainId correctly when it is a valid chain ID', async function () {
      const validateFunction = validateChainID('params.chainId', false);

      for (const chainId of validChainIds) {
        const req = mockRequest(chainId);
        await validateFunction(req, {}, () => {});
        expect(validateResult(req)).to.be.empty;
      }
    });

    it('should throw an error when chainId is an invalid string', async function () {
      const invalidChainId = 'eip155:99999'; // Example of an invalid chain ID
      const validateFunction = validateChainID('params.chainId', false);
      const req = mockRequest(invalidChainId);
      await validateFunction(req, {}, () => {});
      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: invalidChainId,
          msg: 'params.chainId must be a valid and supported EIP155 chain ID',
          path: 'params.chainId',
          location: 'body',
        },
      ]);
    });

    it('should throw an error when chainId is not a string', async function () {
      const nonStringChainId = 12345; // Example of a non-string value
      const validateFunction = validateChainID('params.chainId', false);
      const req = mockRequest(nonStringChainId);
      await validateFunction(req, {}, () => {});
      expect(validateResult(req)).to.deep.equal([
        {
          type: 'field',
          value: nonStringChainId,
          msg: 'params.chainId must be a valid and supported EIP155 chain ID',
          path: 'params.chainId',
          location: 'body',
        },
      ]);
    });
  });
});
