import {
  Chain,
  ChainType,
  FallbackProviderJsonConfig,
} from '@railgun-community/shared-models';

export const MOCK_CHAIN_ETHEREUM: Chain = {
  type: ChainType.EVM,
  id: 1,
};
export const MOCK_CHAIN_GOERLI: Chain = {
  type: ChainType.EVM,
  id: 5,
};
export const MOCK_CHAIN_POLYGON: Chain = {
  type: ChainType.EVM,
  id: 137,
};

export const MOCK_DB_ENCRYPTION_KEY =
  '0101010101010101010101010101010101010101010101010101010101010101';

export const MOCK_MNEMONIC =
  'test test test test test test test test test test test junk';

export const MOCK_MNEMONIC_2 =
  'pause crystal tornado alcohol genre cement fade large song like bag where';

export const MOCK_RAILGUN_WALLET_ADDRESS =
  '0zk1q8hxknrs97q8pjxaagwthzc0df99rzmhl2xnlxmgv9akv32sua0kfrv7j6fe3z53llhxknrs97q8pjxaagwthzc0df99rzmhl2xnlxmgv9akv32sua0kg0zpzts';

export const MOCK_FALLBACK_PROVIDER_JSON_CONFIG: FallbackProviderJsonConfig = {
  chainId: 1,
  providers: [
    {
      provider: 'https://cloudflare-eth.com',
      priority: 1,
      weight: 1,
    },
    {
      provider: 'https://rpc.ankr.com/eth',
      priority: 2,
      weight: 1,
    },
  ],
};
