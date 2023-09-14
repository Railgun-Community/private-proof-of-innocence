import { NetworkName } from '@railgun-community/shared-models';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import {
  NodeStatusForNetwork,
  NodeStatusAllNetworks,
  POIEventListStatus,
} from '../models/api-types';
import { Config } from '../config/config';
import { POIEventList } from '../poi/poi-event-list';

export class NodeStatus {
  static async getNodeStatusAllNetworks(): Promise<NodeStatusAllNetworks> {
    const statusForNetwork: Partial<Record<NetworkName, NodeStatusForNetwork>> =
      {};
    const allNetworks: NetworkName[] = Object.values(Config.NETWORK_NAMES);
    await Promise.all(
      allNetworks.map(async (networkName) => {
        statusForNetwork[networkName] =
          await NodeStatus.getNodeStatus(networkName);
      }),
    );
    return {
      forNetwork: statusForNetwork,
      listKeys: Config.LIST_KEYS,
    };
  }

  private static async getNodeStatus(
    networkName: NetworkName,
  ): Promise<NodeStatusForNetwork> {
    return {
      txidStatus:
        await RailgunTxidMerkletreeManager.getRailgunTxidStatus(networkName),
      eventListStatuses: await NodeStatus.getEventListStatuses(networkName),
    };
  }

  private static async getEventListStatuses(
    networkName: NetworkName,
  ): Promise<Record<string, POIEventListStatus>> {
    const allStatuses: Record<string, POIEventListStatus> = {};
    await Promise.all(
      Config.LIST_KEYS.map(async (listKey) => {
        allStatuses[listKey] = await POIEventList.getEventListStatus(
          networkName,
          listKey,
        );
      }),
    );
    return allStatuses;
  }
}
