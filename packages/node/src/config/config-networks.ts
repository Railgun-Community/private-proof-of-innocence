import fallbackProvidersEthereum from './fallback-providers/1-ethereum';
import fallbackProvidersEthereumGoerli from './fallback-providers/5-ethereum-goerli';
import fallbackProvidersEthereumSepolia from './fallback-providers/11155111-ethereum-sepolia';
import fallbackProvidersBNBChain from './fallback-providers/56-binance-smart-chain';
import fallbackProvidersPolygon from './fallback-providers/137-polygon-pos';
import fallbackProvidersArbitrum from './fallback-providers/42161-arbitrum';
import fallbackProvidersPolygonMumbai from './fallback-providers/80001-polygon-mumbai';
import fallbackProvidersHardhat from './fallback-providers/31337-hardhat';
import fallbackProvidersArbitrumGoerli from './fallback-providers/421613-arbitrum-goerli';
import {
  FallbackProviderJsonConfig,
  NetworkName,
} from '@railgun-community/shared-models';

type NetworkConfig = {
  fallbackProviderConfig: FallbackProviderJsonConfig;
};

const configNetworks: Partial<Record<NetworkName, NetworkConfig>> = {
  [NetworkName.Ethereum]: {
    fallbackProviderConfig: fallbackProvidersEthereum,
  },
  [NetworkName.BNBChain]: {
    fallbackProviderConfig: fallbackProvidersBNBChain,
  },
  [NetworkName.Polygon]: {
    fallbackProviderConfig: fallbackProvidersPolygon,
  },
  [NetworkName.Arbitrum]: {
    fallbackProviderConfig: fallbackProvidersArbitrum,
  },

  // TEST NETS
  [NetworkName.EthereumGoerli_DEPRECATED]: {
    fallbackProviderConfig: fallbackProvidersEthereumGoerli,
  },
  [NetworkName.ArbitrumGoerli]: {
    fallbackProviderConfig: fallbackProvidersArbitrumGoerli,
  },
  [NetworkName.PolygonMumbai]: {
    fallbackProviderConfig: fallbackProvidersPolygonMumbai,
  },
  [NetworkName.Hardhat]: {
    fallbackProviderConfig: fallbackProvidersHardhat,
  },
  [NetworkName.EthereumSepolia]: {
    fallbackProviderConfig: fallbackProvidersEthereumSepolia,
  },
};

export { configNetworks };
