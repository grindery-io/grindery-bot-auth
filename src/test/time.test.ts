import chai from 'chai';
import {
  get24HoursBeforeDate,
  getLast24HoursDateTime,
  getLastHourDateTime,
  getOneHourBeforeDate,
  getXDayBeforeDate,
  getXHourBeforeDate,
  getXMinBeforeDate,
} from '../utils/time';

describe('Time function', async function () {
  describe('getLastHourDateTime function', async function () {
    it('Should return a Date object', async function () {
      const result = getLastHourDateTime();
      chai.expect(result).to.be.instanceOf(Date);
    });

    it('Should return the date and time of the last hour', async function () {
      const now = new Date();
      const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
      const result = getLastHourDateTime();

      // Set a threshold to account for potential slight time differences
      const threshold = 1000; // 1 second

      chai
        .expect(result.getTime())
        .to.be.closeTo(lastHour.getTime(), threshold);
    });
  });

  describe('getLast24HoursDateTime function', async function () {
    it('Should return a Date object', async function () {
      const result = getLast24HoursDateTime();
      chai.expect(result).to.be.instanceOf(Date);
    });

    it('Should return the date and time of 24 hours ago', async function () {
      const now = new Date();
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const result = getLast24HoursDateTime();

      // Set a threshold to account for potential slight time differences
      const threshold = 1000; // 1 second

      chai
        .expect(result.getTime())
        .to.be.closeTo(last24Hours.getTime(), threshold);
    });
  });

  describe('getOneHourBeforeDate function', async function () {
    it('Should return a Date object for 1 hour before the provided date', async function () {
      const currentDate = new Date();
      const oneHourBefore = getOneHourBeforeDate(currentDate);
      chai.expect(oneHourBefore).to.be.instanceOf(Date);
    });

    it('Should return the date and time of 1 hour before the provided date', async function () {
      const testDate = new Date('2023-01-01T12:00:00Z');
      const expectedDate = new Date('2023-01-01T11:00:00Z');

      chai
        .expect(getOneHourBeforeDate(testDate).getTime())
        .to.be.equal(expectedDate.getTime());
    });
  });

  describe('getTwentyFourHoursBeforeDate function', async function () {
    it('Should return a Date object for 24 hours before the provided date', async function () {
      const currentDate = new Date();
      const twentyFourHoursBefore = get24HoursBeforeDate(currentDate);
      chai.expect(twentyFourHoursBefore).to.be.instanceOf(Date);
    });

    it('Should return the date and time of 24 hours before the provided date', async function () {
      const testDate = new Date('2023-01-10T12:00:00Z');
      const expectedDate = new Date('2023-01-09T12:00:00Z');

      chai
        .expect(get24HoursBeforeDate(testDate).getTime())
        .to.be.equal(expectedDate.getTime());
    });
  });

  describe('getXMinBeforeDate function', async function () {
    it('Should return a Date object', async function () {
      const currentDate = new Date();
      const result = getXMinBeforeDate(currentDate, 1);
      chai.expect(result).to.be.instanceOf(Date);
    });

    it('Should return the date and time before the provided date by specified minutes', async function () {
      const testDate = new Date('2023-01-01T12:00:00Z');
      const expectedDate = new Date('2023-01-01T11:55:00Z'); // Five minutes before the test date

      chai
        .expect(getXMinBeforeDate(testDate, 5).getTime())
        .to.be.equal(expectedDate.getTime());
    });
  });

  describe('getXHourBeforeDate function', async function () {
    it('Should return a Date object', async function () {
      const currentDate = new Date();
      const result = getXHourBeforeDate(currentDate, 1);
      chai.expect(result).to.be.instanceOf(Date);
    });

    it('Should return the date and time before the provided date by specified hours', async function () {
      const testDate = new Date('2023-01-01T12:00:00Z');
      const expectedDate = new Date('2023-01-01T09:00:00Z'); // Three hours before the test date

      chai
        .expect(getXHourBeforeDate(testDate, 3).getTime())
        .to.be.equal(expectedDate.getTime());
    });
  });

  describe('getXDayBeforeDate function', async function () {
    it('Should return a Date object', async function () {
      const currentDate = new Date();
      const result = getXDayBeforeDate(currentDate, 1);
      chai.expect(result).to.be.instanceOf(Date);
    });

    it('Should return the date and time before the provided date by specified days', async function () {
      const testDate = new Date('2023-01-10T12:00:00Z');
      const expectedDate = new Date('2023-01-07T12:00:00Z'); // Three days before the test date

      chai
        .expect(getXDayBeforeDate(testDate, 3).getTime())
        .to.be.equal(expectedDate.getTime());
    });
  });
});
