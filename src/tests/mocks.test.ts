import {
  Chain,
  NETWORK_CONFIG,
  NetworkName,
} from '@railgun-community/shared-models';

export const CHAIN_ETHEREUM: Chain = NETWORK_CONFIG[NetworkName.Ethereum].chain;

export const MOCK_EXCLUDED_ADDRESS_1 =
  '0x1234567890123456789012345678901234567890';
