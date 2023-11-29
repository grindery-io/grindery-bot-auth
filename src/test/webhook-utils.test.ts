import chai from 'chai';
import { TRANSACTION_STATUS } from '../utils/constants';
import {
  isFailedTransaction,
  isPendingTransactionHash,
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
});
