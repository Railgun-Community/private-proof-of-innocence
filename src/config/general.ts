import {
  NETWORK_CONFIG,
  Network,
  NetworkName,
  isDefined,
} from '@railgun-community/shared-models';

export const networkForName = (networkName: NetworkName): Network => {
  const network = NETWORK_CONFIG[networkName];
  if (!isDefined(network)) {
    throw new Error(`No network info available for ${networkName}`);
  }
  return network;
};
