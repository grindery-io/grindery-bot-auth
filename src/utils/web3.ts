import { G1_POLYGON_ADDRESS } from '../../secrets';
import { CHAIN_MAPPING } from './chains';
import ERC20 from '../routes/abi/ERC20.json';
import Web3 from 'web3';
import BN from 'bn.js';

export function getContract(
  chainId = 'eip155:137',
  tokenAddress = G1_POLYGON_ADDRESS,
) {
  if (!CHAIN_MAPPING[chainId]) {
    throw new Error('Invalid chain: ' + chainId);
  }

  return new new Web3(CHAIN_MAPPING[chainId][1]).eth.Contract(
    ERC20 as any,
    tokenAddress,
  );
}

export function numberToString(arg: any) {
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

export function scaleDecimals(etherInput: string, decimals: number) {
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

  whole = new BN(whole);
  fraction = new BN(fraction);
  let wei = whole.mul(base).add(fraction);

  if (negative) {
    wei = wei.mul(new BN(-1));
  }

  return wei.toString(10);
}
