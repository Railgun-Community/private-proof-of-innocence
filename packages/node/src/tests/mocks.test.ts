import {
  Chain,
  NETWORK_CONFIG,
  NetworkName,
 SnarkProof } from '@railgun-community/shared-models';

export const CHAIN_ETHEREUM: Chain = NETWORK_CONFIG[NetworkName.Ethereum].chain;

export const MOCK_EXCLUDED_ADDRESS_1 =
  '0x1234567890123456789012345678901234567890';

export const MOCK_SNARK_PROOF: SnarkProof = {
  pi_a: ['0x1234', '0x5678'],
  pi_b: [
    ['0x1234', '0x5678'],
    ['0x123456', '0x567890'],
  ],
  pi_c: ['0x1234', '0x567890'],
};

export const MOCK_LIST_KEYS = ['test-key-1', 'test-key-2'];
