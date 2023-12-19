import { minutesUntilJanFirst2024 } from './time';

/**
 * Coefficient A used in a mathematical function.
 */
export const FUNCTION_PARAMETER_A: number = 5;

/**
 * Coefficient B used in a mathematical function.
 */
export const FUNCTION_PARAMETER_B: number = 223.175920819801;

/**
 * Coefficient C used in a mathematical function.
 */
export const FUNCTION_PARAMETER_C: number = 0.005;

/**
 * Coefficient D used in a mathematical function.
 */
export const FUNCTION_PARAMETER_D: number = 1;

/**
 * Maximum allowed USD cap.
 */
export const USD_CAP: number = 500;

/**
 * Exchange rate between G1 and USD.
 */
export const EXCHANGE_RATE_G1_USD: number = 1000;

/**
 * Exchange rate between GX and USD.
 */
export const EXCHANGE_RATE_GX_USD: number = 1 / 0.036;

/**
 * Exchange rate between GX and G1.
 */
export const EXCHANGE_RATE_GX_G1: number =
  EXCHANGE_RATE_GX_USD / EXCHANGE_RATE_G1_USD;

/**
 * Initial factor for time effect calculation.
 */
export const TIME_EFFECT_INITIAL_FACTOR: number = 1.15;

/**
 * Final factor for time effect calculation.
 */
export const TIME_EFFECT_FINAL_FACTOR: number = 1;

/**
 * Represents the constant defining the number of minutes from a reference time
 * to a deadline for time effect calculation.
 */
export const TIME_EFFECT_MINUTE_TO_DEADLINE = 23712;

/**
 * Decaying slope used in time effect calculation based on time until Jan 1, 2024.
 */
export const TIME_EFFECT_DECAYING_SLOPE: number =
  (TIME_EFFECT_INITIAL_FACTOR - TIME_EFFECT_FINAL_FACTOR) /
  TIME_EFFECT_MINUTE_TO_DEADLINE;

/**
 * Computes the ratio between USD quantity and G1 quantity.
 * @param {number} usdQuantity - The quantity in USD.
 * @param {number} g1Quantity - The quantity in G1.
 * @returns {number} The computed ratio of USD to G1.
 * @throws {Error} Throws an error if the G1 quantity is zero.
 */
export function computeUSDtoG1Ratio(
  usdQuantity: number,
  g1Quantity: number,
): number {
  if (g1Quantity === 0) {
    throw new Error('G1 quantity cannot be zero.');
  }

  return usdQuantity / g1Quantity;
}

/**
 * Computes the factor based on USD and G1 quantities.
 * @param {number} usdQuantity - The quantity in USD.
 * @param {number} g1Quantity - The quantity in G1.
 * @returns {number} The computed factor.
 * @throws {Error} Throws an error if the G1 quantity is zero.
 */
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

/**
 * Converts a quantity in USD to GX.
 * @param {number} usdQuantity - The quantity in USD to convert.
 * @returns {number} The equivalent quantity in GX.
 */
export function getGxFromUSD(usdQuantity: number): number {
  return usdQuantity * EXCHANGE_RATE_GX_USD;
}

/**
 * Converts a quantity in G1 to GX based on the provided USD and G1 quantities.
 * @param {number} usdQuantity - The quantity in USD.
 * @param {number} g1Quantity - The quantity in G1 to convert.
 * @returns {number} The equivalent quantity in GX.
 */
export function getGxFromG1(usdQuantity: number, g1Quantity: number): number {
  return (
    g1Quantity * EXCHANGE_RATE_GX_G1 * computeFactor(usdQuantity, g1Quantity)
  );
}

/**
 * Calculates the total quantity of GX before MVU (Market Value Update) based on the provided USD and G1 quantities.
 * @param {number} usdQuantity - The quantity in USD.
 * @param {number} g1Quantity - The quantity in G1.
 * @returns {number} The total quantity of GX before MVU.
 */
export function getGxBeforeMVU(
  usdQuantity: number,
  g1Quantity: number,
): number {
  return getGxFromG1(usdQuantity, g1Quantity) + getGxFromUSD(usdQuantity);
}

/**
 * Calculates the total quantity of GX after MVU based on the provided USD, G1 quantities, and MVU factor.
 * @param {number} usdQuantity - The quantity in USD.
 * @param {number} g1Quantity - The quantity in G1.
 * @param {number} mvu - The MVU factor.
 * @returns {number} The total quantity of GX after MVU.
 */
export function getGxAfterMVU(
  usdQuantity: number,
  g1Quantity: number,
  mvu: number,
): number {
  // Calculate the intermediate value using MVU factor
  const intermediateValue =
    FUNCTION_PARAMETER_C * Math.pow(mvu, 2) + FUNCTION_PARAMETER_D;

  // Calculate GX quantities from USD and G1
  const gx_from_usd = getGxFromUSD(usdQuantity);
  const gx_from_g1 = getGxFromG1(usdQuantity, g1Quantity);

  // Check if the total GX exceeds the USD cap
  if ((gx_from_usd + gx_from_g1) / EXCHANGE_RATE_GX_USD > USD_CAP) {
    // If total GX exceeds the cap, compute GX after MVU considering cap limit
    return (
      intermediateValue * (USD_CAP * EXCHANGE_RATE_GX_USD) +
      (gx_from_usd + gx_from_g1 - USD_CAP * EXCHANGE_RATE_GX_USD)
    );
  } else {
    // If total GX does not exceed the cap, compute GX after MVU without considering cap limit
    return intermediateValue * (gx_from_usd + gx_from_g1);
  }
}

/**
 * Calculates the total quantity of GX after MVU considering the time effect based on provided parameters.
 * @param {number} usdQuantity - The quantity in USD.
 * @param {number} g1Quantity - The quantity in G1.
 * @param {number} mvu - The MVU factor.
 * @returns {number} The total quantity of GX after MVU with time effect.
 */
export function getGxAfterMVUWithTimeEffect(
  usdQuantity: number,
  g1Quantity: number,
  mvu: number,
): number {
  // Calculate the time difference between the target date and the provided time
  const maxDifference = Math.max(
    TIME_EFFECT_MINUTE_TO_DEADLINE - minutesUntilJanFirst2024(),
    0,
  );

  // Calculate the total GX after MVU and apply the time effect
  return (
    getGxAfterMVU(usdQuantity, g1Quantity, mvu) *
    (TIME_EFFECT_INITIAL_FACTOR - TIME_EFFECT_DECAYING_SLOPE * maxDifference)
  );
}

/**
 * Calculates the total equivalent quantity in USD based on provided parameters after considering MVU and time effects.
 * @param {number} usdQuantity - The quantity in USD.
 * @param {number} g1Quantity - The quantity in G1.
 * @param {number} mvu - MVU factor.
 * @returns {number} The total equivalent quantity in USD after MVU and time effects.
 */
export function getTotalUSD(
  usdQuantity: number,
  g1Quantity: number,
  mvu: number,
): number {
  // Calculate the total quantity of GX after MVU with time effect
  const gxAfterMVUWithTimeEffect = getGxAfterMVUWithTimeEffect(
    usdQuantity,
    g1Quantity,
    mvu,
  );

  // Convert the total GX after MVU with time effect to USD
  return gxAfterMVUWithTimeEffect / EXCHANGE_RATE_GX_USD;
}

/**
 * Computes the conversion details from G1 to GX and its equivalent investments in USD based on provided parameters after considering Market Value Update (MVU) and time effects.
 * @param {number} usdQuantity - The quantity in USD.
 * @param {number} g1Quantity - The quantity in G1.
 * @param {number} mvu - The Market Value Update (MVU) factor.
 * @returns {object} An object containing details of the conversion and its equivalent investments in USD.
 */
export function computeG1ToGxConversion(
  usdQuantity: number,
  g1Quantity: number,
  mvu: number,
) {
  // Calculate different quantities and effects
  const gxAfterMVU = getGxAfterMVU(usdQuantity, g1Quantity, mvu);
  const gxFromG1 = getGxFromG1(usdQuantity, g1Quantity);
  const gxFromUSD = getGxFromUSD(usdQuantity);
  const gxBeforeMVU = getGxBeforeMVU(usdQuantity, g1Quantity);
  const gxAfterMVUWithTimeEffect = getGxAfterMVUWithTimeEffect(
    usdQuantity,
    g1Quantity,
    mvu,
  );

  // Calculate quantities in USD
  const from_usd_investment = gxFromUSD / EXCHANGE_RATE_GX_USD;
  const from_g1_holding = gxFromG1 / EXCHANGE_RATE_GX_USD;
  const from_mvu = (gxAfterMVU - gxBeforeMVU) / EXCHANGE_RATE_GX_USD;
  const from_time =
    (gxAfterMVUWithTimeEffect - gxAfterMVU) / EXCHANGE_RATE_GX_USD;
  const equivalent_usd_invested =
    from_usd_investment + from_g1_holding + from_mvu + from_time;

  // Calculate different effects
  const before_mvu =
    (from_g1_holding + from_usd_investment) * EXCHANGE_RATE_GX_USD;
  const mvu_effect = from_mvu * EXCHANGE_RATE_GX_USD;
  const time_effect = gxAfterMVUWithTimeEffect - (before_mvu + mvu_effect);
  const equivalent_gx_usd_exchange_rate =
    (before_mvu + mvu_effect + time_effect) /
    (from_usd_investment + from_g1_holding);

  // Return an object with conversion details and equivalencies
  return {
    from_usd_investment,
    from_g1_holding,
    from_mvu,
    from_time,
    equivalent_usd_invested,
    before_mvu,
    mvu_effect,
    time_effect,
    equivalent_gx_usd_exchange_rate,
    standard_gx_usd_exchange_rate: EXCHANGE_RATE_GX_USD,
    discount_received:
      (1 - EXCHANGE_RATE_GX_USD / equivalent_gx_usd_exchange_rate) * 100,
  };
}
