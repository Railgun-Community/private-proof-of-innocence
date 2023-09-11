import { NetworkName } from '@railgun-community/shared-models';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { NodeStatus, NodeStatusAllNetworks } from '../models/api-types';
import { Config } from '../config/config';

const getNodeStatus = async (networkName: NetworkName): Promise<NodeStatus> => {
  return {
    txidStatus:
      await RailgunTxidMerkletreeManager.getRailgunTxidStatus(networkName),
  };
};

export const getNodeStatusAllNetworks =
  async (): Promise<NodeStatusAllNetworks> => {
    const allStatuses: Partial<Record<NetworkName, NodeStatus>> = {};
    const allNetworks: NetworkName[] = Object.values(Config.NETWORK_NAMES);
    await Promise.all(
      allNetworks.map(async (networkName) => {
        allStatuses[networkName] = await getNodeStatus(networkName);
      }),
    );
    return allStatuses;
  };
