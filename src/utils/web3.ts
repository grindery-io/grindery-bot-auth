import { G1_POLYGON_ADDRESS } from '../../secrets';
import { CHAIN_MAPPING } from './chains';
import ERC20 from '../routes/abi/ERC20.json';
import Web3 from 'web3';

export function getERC20Contract(
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
