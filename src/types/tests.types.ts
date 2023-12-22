import { SinonStub } from 'sinon';
import { RewardParams } from './webhook.types';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  methods: any;
};

/**
 * Type definition for a SinonStub representing a stub of reward function.
 * This type captures the signature of the reward stub.
 * @template [RewardParams] - The type for the parameters expected by reward function.
 * @returns Promise<boolean> - The resolved promise value of type boolean.
 */
export type RewardStub = SinonStub<[RewardParams], Promise<boolean>>;
