import axios from 'axios';
import { Database } from '../db/conn';
import {
  REWARDS_COLLECTION,
  TRANSFERS_COLLECTION,
  USERS_COLLECTION,
  SWAPS_COLLECTION,
  VESTING_COLLECTION,
} from '../utils/constants';
import { GRINDERY_NEXUS_REFRESH_TOKEN } from '../../secrets';

/**
 * Retrieves the database mock instance.
 * @returns A promise resolving to the database mock instance.
 */
export async function getDbMock() {
  const dbMock = await Database.getInstance();
  return dbMock;
}

/**
 * Retrieves the collection for mock users.
 * @returns A promise resolving to the collection of mock users.
 */
export async function getCollectionUsersMock() {
  const dbMock = await getDbMock();
  return dbMock.collection(USERS_COLLECTION);
}

/**
 * Retrieves the collection for mock rewards.
 * @returns A promise resolving to the collection of mock rewards.
 */
export async function getCollectionRewardsMock() {
  const dbMock = await getDbMock();
  return dbMock.collection(REWARDS_COLLECTION);
}

/**
 * Retrieves the collection for mock transfers.
 * @returns A promise resolving to the collection of mock transfers.
 */
export async function getCollectionTransfersMock() {
  const dbMock = await getDbMock();
  return dbMock.collection(TRANSFERS_COLLECTION);
}

/**
 * Retrieves the collection for mock vestings.
 * @returns A promise resolving to the collection of mock vestings.
 */
export async function getCollectionVestingsMock() {
  const dbMock = await getDbMock();
  return dbMock.collection(VESTING_COLLECTION);
}

/**
 * Retrieves the collection for mock swaps.
 * @returns A promise resolving to the collection of mock swaps.
 */
export async function getCollectionSwapsMock() {
  const dbMock = await getDbMock();
  return dbMock.collection(SWAPS_COLLECTION);
}

export const mockUserTelegramID = '2114356934';
export const mockResponsePath = '64d170d6dc5a2a45328ad6f6/c/43320456';
export const mockUserHandle = 'myUserHandle';
export const mockUserName = 'myUserName';
export const mockWallet = '0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5';

export const mockUserTelegramID1 = '2114356931';
export const mockResponsePath1 = '64d170d6dc5a2a45328ad6f6/c/43320452';
export const mockUserHandle1 = 'myUserHandle1';
export const mockUserName1 = 'myUserName1';
export const mockWallet1 = '0x594CfCaa67Bc8789D17D39eb5F1DfC7dD95242cd';

export const mockUserTelegramID2 = '2114276931';
export const mockResponsePath2 = '64d170d6dc5a2a45328ad6f6/c/43320453';
export const mockUserHandle2 = 'myUserHandle2';
export const mockUserName2 = 'myUserName2';
export const mockWallet2 = '0x699791A03Ac2B58E1B7cA29B601C69F223c78e9c';

export const mockUserTelegramID3 = '2114276967';
export const mockResponsePath3 = '64d170d6dc5a2a45328ad6f6/c/43322353';
export const mockUserHandle3 = 'myUserHandle3';
export const mockUserName3 = 'myUserName3';
export const mockWallet3 = '0x51a1449b3B6D635EddeC781cD47a99221712De97';

export const mockTokenAddress = '0xe36BD65609c08Cd17b53520293523CF4560533d0';
export const mockChainId = 'eip155:137';
export const mockChainName = 'matic';

export const mockToSwap = '0x38147794FF247e5Fc179eDbAE6C37fff88f68C52';
export const mockFromSwap = '0x699791A03Ac2B58E1B7cA29B601C69F223c78e9c';
export const mockValue = '1000000';
export const mockTokenInSymbol = 'USDT';
export const mockTokenIn = '0x8f3cf7ad23cd3cadbd9735aff958023239c6a063';
export const mockAmountIn = '1000000';
export const mockTokenOutSymbol = 'USDC';
export const mockTokenOut = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
export const mockAmountOut = '1000333';
export const mockPriceImpact = '8';
export const mockGas = '170278';
export const mockDataSwap =
  '0x8fd8d1bbf34964a871c716690e00077be071c7ec820cbd6b2db15d90e2198476cfa733be000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000006095ea7b3010001ffffffffffc2132d05d31c914a87c6611c10748aeb04b58e8f19198595a30283ffffffff831111111254eeb25477b68fb85ed929f73a9605829bd3b227018302ffffffff036675a323dedb77822fcf39eaa9d682f6abe72555ddcd52200103ffffffffff037e7d64d987cab6eed08a191c4c2459daf2f8ed0b6e7a43a3010304ffffffff037e7d64d987cab6eed08a191c4c2459daf2f8ed0b241c59120103ffffffffffff7e7d64d987cab6eed08a191c4c2459daf2f8ed0b000000000000000000000000000000000000000000000000000000000000000500000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000160000000000000000000000000000000000000000000000000000000000000046000000000000000000000000000000000000000000000000000000000000000200000000000000000000000001111111254eeb25477b68fb85ed929f73a960582000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002c812aa3caf000000000000000000000000e37e799d5077682fa0a244d46e5649f71457bd09000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f0000000000000000000000003c499c542cef5e3811e1192ce70d8cc03d5c3359000000000000000000000000e37e799d5077682fa0a244d46e5649f71457bd09000000000000000000000000b7456c6085009a0721335b925f8aeccbd4a2815f00000000000000000000000000000000000000000000000000000000000f424000000000000000000000000000000000000000000000000000000000000ecea60000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000013a00000000000000000000000000000000000000000000000000000000011c4330a70dfb3f3b36d69ba3f6efa8949126999906595d00000000000000000000000000000000000000000000000000000000000ecea6002424b31a0c0000000000000000000000001111111254eeb25477b68fb85ed929f73a96058200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fffd8963efd1fc6a506488495d951d5263988d2500000000000000000000000000000000000000000000000000000000000000a00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000c2132d05d31c914a87c6611c10748aeb04b58e8f000000000000d5504337000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000ecea6';

export const mockAccessToken =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const mockTransactionHash =
  '0xd7ca91c2ed1c33fc97366861487e731f0eacbec2bdb76cd09b34679e6cade9b3';
export const mockTransactionHash1 =
  '0x93c0ca80f2171b05b68531d176183efcbad940265be5e21b1c12d6f321bd44b9';
export const mockTransactionHash2 =
  '0x88be0d614f53ab6cc1339194356980711765ea1511105d4c582e79c099402911';
export const mockUserOpHash =
  '0x938cfe7b1fd476d96965d0dfecf86097bb05502856c8eabf175deac507328f3e';
export const mockUserOpHash1 =
  '0xacdf0f6fa96a50ca250f759dcd9502c3a16c65b076d6114fc5c53a832897e0a0';
export const mockUserOpHash2 =
  '0x072d67eb495c7be8d14f188043065e3c7054a1d12bb15101710c90fea11330cd';

/**
 * Retrieves the access token.
 * @returns A promise resolving to the access token.
 */
async function getAccessToken(): Promise<string> {
  try {
    const res = await axios.post(
      'https://orchestrator.grindery.org/oauth/token',
      {
        grant_type: 'refresh_token',
        refresh_token: GRINDERY_NEXUS_REFRESH_TOKEN,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    return res.data.access_token;
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Mocked token retrieved as an access token.
 */
export const mockedToken = getAccessToken();

/**
 * Represents a smart contract stub with methods of any type.
 * This type is used to define an object structure containing contract methods.
 */
export type ContractStub = {
  /**
   * Methods within the contract.
   * Type: any
   * This property holds the methods associated with the contract, allowing flexibility in method definitions.
   */
  methods: any;
};
