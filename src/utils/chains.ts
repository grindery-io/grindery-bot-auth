import {
  ALCHEMY_API_KEY,
  ANKR_KEY,
  GETBLOCK_API_KEY,
  LAVANET_API_KEY,
  CHAINSTACK_API_KEY,
  CHAINSTACK_API_KEY_2,
} from '../../secrets';

/**
 * Retrieves ANKR WebSocket and HTTP endpoints based on the provided network name.
 * @param name The network name.
 * @returns An array containing WebSocket and HTTP endpoints.
 */
const ANKR = (name: string) => [
  `wss://rpc.ankr.com/${name}/ws/${ANKR_KEY || ''}`,
  `https://rpc.ankr.com/${name}/${ANKR_KEY || ''}`,
];

/**
 * Retrieves ALCHEMY WebSocket and HTTP endpoints based on the provided network name.
 * @param name The network name.
 * @returns An array containing WebSocket and HTTP endpoints.
 */
const ALCHEMY = (name: string) => [
  `wss://${name}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  `https://${name}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
];

/**
 * Retrieves GETBLOCK WebSocket and HTTP endpoints based on the provided network name and type.
 * @param name The network name.
 * @param netType The network type. Default is 'mainnet'.
 * @returns An array containing WebSocket and HTTP endpoints.
 */
const GETBLOCK = (name: string, netType = 'mainnet') => [
  `wss://${name}.getblock.io/${GETBLOCK_API_KEY}/${netType}/`,
  `https://${name}.getblock.io/${GETBLOCK_API_KEY}/${netType}/`,
];

/**
 * Retrieves LAVANET WebSocket and HTTP endpoints based on the provided WebSocket and HTTP paths.
 * @param wsPath The WebSocket path.
 * @param httpsPath The HTTP path.
 * @returns An array containing WebSocket and HTTP endpoints.
 */
const LAVANET = (wsPath: string, httpsPath: string) => [
  `wss://g.w.lavanet.xyz:443/gateway/${wsPath}/${LAVANET_API_KEY}`,
  `https://g.w.lavanet.xyz:443/gateway/${httpsPath}/${LAVANET_API_KEY}`,
];

/**
 * Retrieves CHAINSTACK WebSocket and HTTP endpoints based on the provided node ID and key.
 * @param nodeId The node ID.
 * @param key The key.
 * @returns An array containing WebSocket and HTTP endpoints.
 */
const CHAINSTACK = (nodeId: string, key: string) => [
  `wss://ws-${nodeId}.p2pify.com/${key || CHAINSTACK_API_KEY}`,
  `https://${nodeId}.p2pify.com/${key || CHAINSTACK_API_KEY}`,
];

/**
 * Mapping of chain IDs to their respective WebSocket and HTTP endpoints.
 */
export const CHAIN_MAPPING = {
  'eip155:1': ANKR('eth'),
  eth: ANKR('eth'),
  'eip155:42161': ANKR('arbitrum'),
  arb1: ANKR('arbitrum'),
  gno: ANKR('gnosis'),
  'eip155:100': ANKR('gnosis'),
  'eip155:137': ANKR('polygon'),
  matic: ANKR('polygon'),
  'eip155:42220': ANKR('celo'),
  'eip155:43114': ANKR('avalanche'),
  'eip155:56': ANKR('bsc'),
  'eip155:250': ANKR('fantom'),
  'eip155:1666600000': ANKR('harmony'),
  'eip155:25': GETBLOCK('cro'),
  'eip155:1101': ANKR('polygon_zkevm'),
  'eip155:1284': ANKR('moonbeam'),
  'eip155:80001': ANKR('polygon_mumbai'),
  maticmum: ANKR('polygon_mumbai'),
  'eip155:5': ALCHEMY('eth-goerli'),
  'eip155:11155111': ANKR('eth_sepolia'),
  'eip155:97': CHAINSTACK('nd-519-425-794', CHAINSTACK_API_KEY_2),
  'eip155:4002': ANKR('fantom_testnet'),
  'eip155:1442': ANKR('polygon_zkevm_testnet'),
  'eip155:338': CHAINSTACK('nd-326-373-985', CHAINSTACK_API_KEY_2),
  'eip155:44787': LAVANET('alfajores/rpc', 'alfajores/rpc-http'),
  'eip155:9000': LAVANET('evmost/json-rpc', 'evmost/json-rpc-http'),
  'eip155:59144': ANKR('linea'),
};

export const CHAIN_NAME_MAPPING = {
  'eip155:137': 'matic',
  'eip155:59144': 'linea',
};
