import {
  NETWORK_CONFIG,
  Network,
  NetworkName,
  isDefined,
  networkForChain,
} from '@railgun-community/shared-models';

export const networkForName = (networkName: NetworkName): Network => {
  const network = NETWORK_CONFIG[networkName];
  if (!isDefined(network)) {
    throw new Error(`No network info available for ${networkName}`);
  }
  return network;
};

export const networkNameForSerializedChain = (
  chainType: string,
  chainID: string,
): NetworkName => {
  const networkName = networkForChain({
    type: Number(chainType),
    id: Number(chainID),
  })?.name;
  if (!isDefined(networkName)) {
    throw new Error('No network info available.');
  }
  return networkName;
};
