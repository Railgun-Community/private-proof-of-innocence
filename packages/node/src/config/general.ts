import {
  Chain,
  NETWORK_CONFIG,
  Network,
  NetworkName,
  isDefined,
  networkForChain,
  removeUndefineds,
} from '@railgun-community/shared-models';
import { Config } from './config';
import { NodeConfig } from '../models/general-types';

export const networkForName = (networkName: NetworkName): Network => {
  const network = NETWORK_CONFIG[networkName];
  if (!isDefined(network)) {
    throw new Error(`No network info available for ${networkName}`);
  }
  return network;
};

export const chainForNetwork = (networkName: NetworkName): Chain => {
  return networkForName(networkName).chain;
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

export const nodeURLForListKey = (listKey: string): Optional<string> => {
  return Config.NODE_CONFIGS.find(nodeConfig => nodeConfig.listKey === listKey)
    ?.nodeURL;
};

export const getListKeysFromNodeConfigs = (
  nodeConfigs: NodeConfig[],
): string[] => {
  return removeUndefineds(nodeConfigs.map(nodeConfig => nodeConfig.listKey));
};
