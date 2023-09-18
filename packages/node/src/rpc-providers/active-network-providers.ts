import { loadEngineProvider } from '../engine/engine-init';
import {
  createFallbackProviderFromJsonConfig,
  FallbackProviderJsonConfig,
  getAvailableProviderJSONs,
  isDefined,
  NetworkName,
} from '@railgun-community/shared-models';
import debug from 'debug';
import { FallbackProvider } from 'ethers';
import { configNetworks } from '../config/config-networks';
import { Config } from '../config/config';
import { networkForName } from '../config/general';

const dbg = debug('relayer:networks');

const activeNetworkProviders: Partial<Record<NetworkName, FallbackProvider>> =
  {};

// eslint-disable-next-line require-await
export const initNetworkProviders = async (networkNames?: NetworkName[]) => {
  const initChains = networkNames ?? Config.NETWORK_NAMES;
  await Promise.all(
    initChains.map(async (networkName: NetworkName) => {
      try {
        await initNetworkProvider(networkName);
      } catch (err) {
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Could not initialize network provider for network: ${networkName} - ${err.message}`,
        );
      }
    }),
  );
};

/**
 * Note: This call is async, but you may call it synchronously
 * so it will run the slow scan in the background.
 */
const initNetworkProvider = async (networkName: NetworkName) => {
  const network = configNetworks[networkName];
  if (!isDefined(network)) {
    throw new Error(`No network config for ${networkName}`);
  }
  const { fallbackProviderConfig } = network;
  const { chain } = networkForName(networkName);
  if (fallbackProviderConfig.chainId !== chain.id) {
    throw new Error(
      `Fallback Provider chain ID ${fallbackProviderConfig.chainId} does not match ID ${chain.id} for network: ${name}`,
    );
  }

  const finalConfig: FallbackProviderJsonConfig = {
    chainId: fallbackProviderConfig.chainId,
    providers: [],
  };
  const availableProviders = await getAvailableProviderJSONs(
    fallbackProviderConfig.chainId,
    [...fallbackProviderConfig.providers],
    dbg,
  );
  finalConfig.providers = availableProviders;
  await loadEngineProvider(networkName, finalConfig);

  const fallbackProvider = createFallbackProviderFromJsonConfig(finalConfig);
  activeNetworkProviders[networkName] = fallbackProvider;
  dbg(`Loaded network ${networkName} - ${chain.type}:${chain.id}`);
};

export const getProviderForNetwork = (
  networkName: NetworkName,
): FallbackProvider => {
  const provider = activeNetworkProviders[networkName];
  if (!isDefined(provider)) {
    throw new Error(`No active provider for network ${networkName}.`);
  }
  return provider;
};
