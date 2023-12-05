import chai from 'chai';
import { TRANSACTION_STATUS } from '../utils/constants';
import {
  isFailedTransaction,
  isGasPriceExceed,
  isPendingTransactionHash,
  isPositiveFloat,
  isSuccessfulTransaction,
} from '../utils/webhooks/utils';

describe('Transaction Status Functions', async function () {
  describe('isSuccessfulTransaction', async function () {
    it('Should identify a successful transaction', async function () {
      chai
        .expect(isSuccessfulTransaction(TRANSACTION_STATUS.SUCCESS))
        .to.equal(true);
    });

    it('Should identify a failed transaction', async function () {
      chai
        .expect(isSuccessfulTransaction(TRANSACTION_STATUS.FAILURE))
        .to.equal(false);
    });

    it('Should identify a pending hash transaction as not successful', async function () {
      chai
        .expect(isSuccessfulTransaction(TRANSACTION_STATUS.PENDING_HASH))
        .to.equal(false);
    });
  });

  describe('isFailedTransaction', async function () {
    it('Should identify a failed transaction', async function () {
      chai
        .expect(isFailedTransaction(TRANSACTION_STATUS.FAILURE))
        .to.equal(true);
    });

    it('Should identify a successful transaction as not failed', async function () {
      chai
        .expect(isFailedTransaction(TRANSACTION_STATUS.SUCCESS))
        .to.equal(false);
    });

    it('Should identify a pending hash transaction as not failed', async function () {
      chai
        .expect(isFailedTransaction(TRANSACTION_STATUS.PENDING_HASH))
        .to.equal(false);
    });
  });

  describe('isPendingTransactionHash', async function () {
    it('Should identify a pending hash transaction', async function () {
      chai
        .expect(isPendingTransactionHash(TRANSACTION_STATUS.PENDING_HASH))
        .to.equal(true);
    });

    it('Should identify a successful transaction as not pending hash', async function () {
      chai
        .expect(isPendingTransactionHash(TRANSACTION_STATUS.SUCCESS))
        .to.equal(false);
    });

    it('Should identify a failed transaction as not pending hash', async function () {
      chai
        .expect(isPendingTransactionHash(TRANSACTION_STATUS.FAILURE))
        .to.equal(false);
    });
  });

  describe('isPositiveFloat', async function () {
    it('Should identify a positive float number', async function () {
      chai.expect(isPositiveFloat('3.14')).to.equal(true);
    });

    it('Should identify zero as a positive float number', async function () {
      chai.expect(isPositiveFloat('0')).to.equal(true);
    });

    it('Should identify a positive integer as a positive float number', async function () {
      chai.expect(isPositiveFloat('42')).to.equal(true);
      chai.expect(isPositiveFloat('1000000000000000')).to.equal(true);
    });

    it('Should identify a negative float number as not positive', async function () {
      chai.expect(isPositiveFloat('-3.14')).to.equal(false);
    });

    it('Should identify a non-numeric string as not positive', async function () {
      chai.expect(isPositiveFloat('abc')).to.equal(false);
    });

    it('Should identify an empty string as not positive', async function () {
      chai.expect(isPositiveFloat('')).to.equal(false);
    });

    it('Should identify a string with only spaces as not positive', async function () {
      chai.expect(isPositiveFloat('   ')).to.equal(false);
    });

    it('Should identify scientific notation as not positive', async function () {
      chai.expect(isPositiveFloat('2.5e3')).to.equal(false);
    });
  });

  describe('Gas Price Exceed', async function () {
    describe('isGasPriceExceed', async function () {
      it('Should return false when gas price is not informed', async function () {
        chai.expect(isGasPriceExceed('', 'matic')).to.equal(false);
        chai.expect(isGasPriceExceed(' ', 'matic')).to.equal(false);
        chai.expect(isGasPriceExceed(undefined, 'matic')).to.equal(false);
      });

      it('Should return false when does not exist gas price threshold for the informed chain name', async function () {
        chai
          .expect(isGasPriceExceed('100', 'invalid-chain-name'))
          .to.equal(false);
        chai.expect(isGasPriceExceed('100', '')).to.equal(false);
        chai.expect(isGasPriceExceed('100', ' ')).to.equal(false);
        chai.expect(isGasPriceExceed('100', undefined)).to.equal(false);
      });

      it('Should return false when gas price is equal to gas price threshold', async function () {
        chai.expect(isGasPriceExceed('20000', 'matic')).to.equal(false);
      });

      it('Should return true when gas price is bigger then gas price threshold', async function () {
        chai
          .expect(isGasPriceExceed('999999999999999', 'eip155:137'))
          .to.equal(true);
      });
    });
  });
});
