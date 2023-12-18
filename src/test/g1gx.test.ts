import chai from 'chai';
import {
  EXCHANGE_RATE_GX_USD,
  FUNCTION_PARAMETER_A,
  FUNCTION_PARAMETER_B,
  FUNCTION_PARAMETER_C,
  FUNCTION_PARAMETER_D,
  TIME_EFFECT_DECAYING_SLOPE,
  TIME_EFFECT_INITIAL_FACTOR,
  USD_CAP,
  computeFactor,
  computeUSDtoG1Ratio,
  getGxAfterMVU,
  getGxAfterMVUWithTimeEffect,
  getGxBeforeMVU,
  getGxFromG1,
  getGxFromUSD,
  getTotalUSD,
} from '../utils/g1gx';
import { minutesUntilJanFirst2024 } from '../utils/time';

describe('G1 to GX util functions', async function () {
  describe('computeUSDtoG1Ratio function', async function () {
    it('Should return the correct ratio when USD quantity is greater than G1 quantity', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const expectedRatio = 2;

      const result = computeUSDtoG1Ratio(usdQuantity, g1Quantity);
      chai.expect(result).to.equal(expectedRatio);
    });

    it('Should return the correct ratio when G1 quantity is greater than USD quantity', async function () {
      const usdQuantity = 50;
      const g1Quantity = 100;
      const expectedRatio = 0.5;

      const result = computeUSDtoG1Ratio(usdQuantity, g1Quantity);
      chai.expect(result).to.equal(expectedRatio);
    });

    it('Should handle a G1 quantity of 0 and throw an error', async function () {
      const usdQuantity = 50;
      const g1Quantity = 0;

      chai
        .expect(() => computeUSDtoG1Ratio(usdQuantity, g1Quantity))
        .to.throw('G1 quantity cannot be zero.');
    });
  });

  describe('computeFactor function', async function () {
    it('Should handle a G1 quantity of 0 and throw an error', async function () {
      const usdQuantity = 50;
      const g1Quantity = 0;

      chai
        .expect(() => computeFactor(usdQuantity, g1Quantity))
        .to.throw('G1 quantity cannot be zero.');
    });

    it('Should return the correct factor when USD quantity is 0', async function () {
      const usdQuantity = 0;
      const g1Quantity = 10;
      const expectedFactor =
        FUNCTION_PARAMETER_A *
        (1 - Math.exp(-FUNCTION_PARAMETER_B * (1 / g1Quantity)));

      const result = computeFactor(usdQuantity, g1Quantity);
      chai.expect(result).to.equal(expectedFactor);
    });

    it('Should return the correct factor when USD quantity is greater than 0 and G1 quantity is greater than 0', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const expectedFactor =
        FUNCTION_PARAMETER_A * (1 - Math.exp(-FUNCTION_PARAMETER_B * 2));

      const result = computeFactor(usdQuantity, g1Quantity);
      chai.expect(result).to.equal(expectedFactor);
    });
  });

  describe('Conversion functions', async function () {
    it('getGxFromUSD should convert USD to GX correctly', async function () {
      const usdQuantity = 100;

      const result = getGxFromUSD(usdQuantity);

      chai.expect(result).to.equal(usdQuantity / 0.036);
    });

    it('getGxFromG1 should convert G1 to GX correctly', async function () {
      const g1Quantity = 50;
      const usdQuantity = 100;

      const result = getGxFromG1(usdQuantity, g1Quantity);

      chai
        .expect(result)
        .to.equal(
          (g1Quantity / 1000 / 0.036) *
            FUNCTION_PARAMETER_A *
            (1 - Math.exp(-FUNCTION_PARAMETER_B * 2)),
        );
    });

    it('getGxFromUSD should handle a 0 USD quantity', async function () {
      const usdQuantity = 0;

      const result = getGxFromUSD(usdQuantity);
      chai.expect(result).to.equal(0);
    });

    it('getGxFromG1 should handle a 0 G1 quantity', async function () {
      const g1Quantity = 0;
      const usdQuantity = 100;

      chai
        .expect(() => computeUSDtoG1Ratio(usdQuantity, g1Quantity))
        .to.throw('G1 quantity cannot be zero.');
    });
  });

  describe('getGxBeforeMVU function', async function () {
    it('Should return the correct value for Gx before MVU when both quantities are greater than 0', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const expectedGxBeforeMVU =
        getGxFromG1(usdQuantity, g1Quantity) + usdQuantity / 0.036;

      const result = getGxBeforeMVU(usdQuantity, g1Quantity);
      chai.expect(result).to.equal(expectedGxBeforeMVU);
    });

    it('Should return the correct value for Gx before MVU when G1 quantity is 0', async function () {
      const usdQuantity = 100;
      const g1Quantity = 0;

      chai
        .expect(() => getGxBeforeMVU(usdQuantity, g1Quantity))
        .to.throw('G1 quantity cannot be zero.');
    });

    it('Should return the correct value for Gx before MVU when USD quantity is 0', async function () {
      const usdQuantity = 0;
      const g1Quantity = 50;
      const expectedGxBeforeMVU = getGxFromG1(usdQuantity, g1Quantity);

      const result = getGxBeforeMVU(usdQuantity, g1Quantity);
      chai.expect(result).to.equal(expectedGxBeforeMVU);
    });

    it('Should return 0 when both USD and G1 quantities are 0', async function () {
      const usdQuantity = 0;
      const g1Quantity = 0;

      chai
        .expect(() => getGxBeforeMVU(usdQuantity, g1Quantity))
        .to.throw('G1 quantity cannot be zero.');
    });
  });

  describe('getGxAfterMVU function', async function () {
    it('Should return the correct value when the total GX exceeds the USD cap', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const mvu = 10;

      const gxFromUSD = getGxFromUSD(usdQuantity);
      const gxFromG1 = getGxFromG1(usdQuantity, g1Quantity);

      const expectedGxAfterMVU =
        (FUNCTION_PARAMETER_C * Math.pow(mvu, 2) + FUNCTION_PARAMETER_D) *
        (gxFromUSD + gxFromG1);

      const result = getGxAfterMVU(usdQuantity, g1Quantity, mvu);
      chai.expect(result).to.equal(expectedGxAfterMVU);
    });

    it('Should return the correct value when the total GX does not exceed the USD cap', async function () {
      const usdQuantity = 10000000;
      const g1Quantity = 20;
      const mvu = 4;

      const intermediateValue =
        FUNCTION_PARAMETER_C * Math.pow(mvu, 2) + FUNCTION_PARAMETER_D;
      const gxFromUSD = getGxFromUSD(usdQuantity);
      const gxFromG1 = getGxFromG1(usdQuantity, g1Quantity);

      const expectedGxAfterMVU =
        intermediateValue * (USD_CAP * EXCHANGE_RATE_GX_USD) +
        (gxFromUSD + gxFromG1 - USD_CAP * EXCHANGE_RATE_GX_USD);

      const result = getGxAfterMVU(usdQuantity, g1Quantity, mvu);
      chai.expect(result).to.equal(expectedGxAfterMVU);
    });
  });

  describe('getGxAfterMVUWithTimeEffect function', async function () {
    it('Should return the correct value considering time effect when time left is less than minutes until Jan 1, 2024', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const mvu = 10;
      const timeLeft = 5000;

      const expectedGxAfterMVU = getGxAfterMVU(usdQuantity, g1Quantity, mvu);

      const maxDifference = Math.max(minutesUntilJanFirst2024() - timeLeft, 0);
      const expectedGxAfterMVUWithTimeEffect =
        expectedGxAfterMVU *
        (TIME_EFFECT_INITIAL_FACTOR -
          TIME_EFFECT_DECAYING_SLOPE * maxDifference);

      const result = getGxAfterMVUWithTimeEffect(
        usdQuantity,
        g1Quantity,
        mvu,
        timeLeft,
      );
      chai.expect(result).to.equal(expectedGxAfterMVUWithTimeEffect);
    });

    it('Should return the same value as getGxAfterMVU when time left is time left is equal minutesUntilJanFirst2024', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const mvu = 10;
      const timeLeft = minutesUntilJanFirst2024();

      const expectedGxAfterMVU =
        getGxAfterMVU(usdQuantity, g1Quantity, mvu) *
        TIME_EFFECT_INITIAL_FACTOR;
      const result = getGxAfterMVUWithTimeEffect(
        usdQuantity,
        g1Quantity,
        mvu,
        timeLeft,
      );
      chai.expect(result).to.equal(expectedGxAfterMVU);
    });
  });

  describe('getTotalUSD function', async function () {
    it('Should return the correct total USD based on the calculated GX after MVU with time effect', async function () {
      const usdQuantity = 100;
      const g1Quantity = 50;
      const mvu = 10;
      const timeLeft = 5000;

      const expectedGxAfterMVU = getGxAfterMVU(usdQuantity, g1Quantity, mvu);

      const maxDifference = Math.max(minutesUntilJanFirst2024() - timeLeft, 0);
      const expectedGxAfterMVUWithTimeEffect =
        expectedGxAfterMVU *
        (TIME_EFFECT_INITIAL_FACTOR -
          TIME_EFFECT_DECAYING_SLOPE * maxDifference);

      const result = getTotalUSD(usdQuantity, g1Quantity, mvu, timeLeft);
      chai
        .expect(result)
        .to.equal(expectedGxAfterMVUWithTimeEffect / EXCHANGE_RATE_GX_USD);
    });
  });
});
