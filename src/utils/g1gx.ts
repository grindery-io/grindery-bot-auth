import { minutesUntilJanFirst2024 } from './time';

export const FUNCTION_PARAMETER_A: number = 5;
export const FUNCTION_PARAMETER_B: number = 223.18;
export const FUNCTION_PARAMETER_C: number = 0.005;
export const FUNCTION_PARAMETER_D: number = 1;
export const USD_CAP: number = 500;
export const EXCHANGE_RATE_G1_USD: number = 1000;
export const EXCHANGE_RATE_GX_USD: number = 1 / 0.036;
export const EXCHANGE_RATE_GX_G1: number =
  EXCHANGE_RATE_GX_USD / EXCHANGE_RATE_G1_USD;
export const TIME_EFFECT_INITIAL_FACTOR: number = 1.15;
export const TIME_EFFECT_FINAL_FACTOR: number = 1;
export const TIME_EFFECT_DECAYING_SLOPE: number =
  (TIME_EFFECT_INITIAL_FACTOR - TIME_EFFECT_FINAL_FACTOR) /
  minutesUntilJanFirst2024();

export function computeUSDtoG1Ratio(
  usdQuantity: number,
  g1Quantity: number,
): number {
  if (g1Quantity === 0) {
    throw new Error('G1 quantity cannot be zero.');
  }

  return usdQuantity / g1Quantity;
}

export function computeFactor(usdQuantity: number, g1Quantity: number): number {
  if (g1Quantity === 0) {
    throw new Error('G1 quantity cannot be zero.');
  }

  return usdQuantity === 0
    ? FUNCTION_PARAMETER_A *
        (1 - Math.exp(-FUNCTION_PARAMETER_B * (1 / g1Quantity)))
    : FUNCTION_PARAMETER_A *
        (1 -
          Math.exp(
            -FUNCTION_PARAMETER_B *
              computeUSDtoG1Ratio(usdQuantity, g1Quantity),
          ));
}

export function getGxFromUSD(usdQuantity: number): number {
  return usdQuantity * EXCHANGE_RATE_GX_USD;
}

export function getGxFromG1(usdQuantity: number, g1Quantity: number): number {
  return (
    g1Quantity * EXCHANGE_RATE_GX_G1 * computeFactor(usdQuantity, g1Quantity)
  );
}

export function getGxBeforeMVU(
  usdQuantity: number,
  g1Quantity: number,
): number {
  return getGxFromG1(usdQuantity, g1Quantity) + getGxFromUSD(usdQuantity);
}

export function getGxAfterMVU(
  usdQuantity: number,
  g1Quantity: number,
  mvu: number,
): number {
  const intermediateValue =
    FUNCTION_PARAMETER_C * Math.pow(mvu, 2) + FUNCTION_PARAMETER_D;

  const gx_from_usd = getGxFromUSD(usdQuantity);
  const gx_from_g1 = getGxFromG1(usdQuantity, g1Quantity);

  return (gx_from_usd + gx_from_g1) / EXCHANGE_RATE_GX_USD > USD_CAP
    ? intermediateValue * (USD_CAP * EXCHANGE_RATE_GX_USD) +
        (gx_from_usd + gx_from_g1 - USD_CAP * EXCHANGE_RATE_GX_USD)
    : intermediateValue * (gx_from_usd + gx_from_g1);
}

export function getGxAfterMVUWithTimeEffect(
  usdQuantity: number,
  g1Quantity: number,
  mvu: number,
  time_left: number,
): number {
  const maxDifference = Math.max(minutesUntilJanFirst2024() - time_left, 0);

  console.log(maxDifference);
  return (
    getGxAfterMVU(usdQuantity, g1Quantity, mvu) *
    (TIME_EFFECT_INITIAL_FACTOR - TIME_EFFECT_DECAYING_SLOPE * maxDifference)
  );
}
