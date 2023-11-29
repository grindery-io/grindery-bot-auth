import { G1_POLYGON_ADDRESS } from '../../secrets';
import { CHAIN_MAPPING } from './chains';
import ERC20 from '../routes/abi/ERC20.json';
import Web3 from 'web3';
import BN from 'bn.js';
import { Contract } from 'web3-eth-contract';
import { AbiItem } from 'web3-utils';

/**
 * Creates and returns a contract instance using Web3 with the specified chainId and tokenAddress.
 * @param {string} chainId - Chain ID (default: 'eip155:137').
 * @param {string} tokenAddress - Token address (default: G1_POLYGON_ADDRESS from secrets).
 * @returns {Contract} - Web3 contract instance.
 * @throws {Error} - Throws an error if the chainId is invalid.
 */
export function getContract(
  chainId: string = 'eip155:137',
  tokenAddress: string = G1_POLYGON_ADDRESS,
): Contract {
  if (!CHAIN_MAPPING[chainId]) {
    throw new Error('Invalid chain: ' + chainId);
  }

  return new new Web3(CHAIN_MAPPING[chainId][1]).eth.Contract(
    ERC20 as AbiItem[],
    tokenAddress,
  );
}

/**
 * Converts various types of numeric inputs to a string representation.
 * @param {any} arg - Input value to convert to a string.
 * @returns {string} - String representation of the input value.
 * @throws {Error} - Throws an error for invalid number values or types.
 */
export function numberToString(arg: any): string {
  if (typeof arg === 'string') {
    if (!arg.match(/^-?[0-9.]+$/)) {
      throw new Error(
        `while converting number to string, invalid number value '${arg}', should be a number matching (^-?[0-9.]+).`,
      );
    }
    return arg;
  } else if (typeof arg === 'number') {
    return String(arg);
  } else if (
    typeof arg === 'object' &&
    arg.toString &&
    (arg.toTwos || arg.dividedToIntegerBy)
  ) {
    return arg.toPrecision ? String(arg.toPrecision()) : arg.toString(10);
  }
  throw new Error(
    `while converting number to string, invalid number value '${arg}' type ${typeof arg}.`,
  );
}

/**
 * Scales a given Ethereum value with specified decimals.
 * @param {string} etherInput - Ethereum value input.
 * @param {number} decimals - Number of decimals.
 * @returns {string} - Scaled Ethereum value.
 * @throws {Error} - Throws errors for invalid or malformed input values.
 */
export function scaleDecimals(etherInput: string, decimals: number): string {
  let ether = numberToString(etherInput);
  const base = new BN(10).pow(new BN(decimals));
  const baseLength = base.toString(10).length - 1;

  // Is it negative?
  const negative = ether.substring(0, 1) === '-';
  if (negative) {
    ether = ether.substring(1);
  }

  if (ether === '.') {
    throw new Error(
      `[ethjs-unit] while converting number ${etherInput} to wei, invalid value`,
    );
  }

  // Split it into a whole and fractional part
  const comps = ether.split('.');
  if (comps.length > 2) {
    throw new Error(
      `[ethjs-unit] while converting number ${etherInput} to wei, too many decimal points`,
    );
  }

  let whole = comps[0];
  let fraction = comps[1];

  if (!whole) {
    whole = '0';
  }
  if (!fraction) {
    fraction = '0';
  }
  if (fraction.length > baseLength) {
    throw new Error(
      `[ethjs-unit] while converting number ${etherInput} to wei, too many decimal places`,
    );
  }

  while (fraction.length < baseLength) {
    fraction += '0';
  }

  return (
    negative
      ? new BN(whole).mul(base).add(new BN(fraction)).mul(new BN(-1))
      : new BN(whole).mul(base).add(new BN(fraction))
  ).toString(10);
}
