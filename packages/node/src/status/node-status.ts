import {
  NetworkName,
  NodeStatusForNetwork,
  NodeStatusAllNetworks,
  POIListStatus,
} from '@railgun-community/shared-models';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { Config } from '../config/config';
import { POIEventList } from '../poi-events/poi-event-list';
import { TransactProofMempoolCache } from '../proof-mempool/transact-proof-mempool-cache';
import { BlockedShieldsCache } from '../shields/blocked-shields-cache';
import { getShieldQueueStatus } from '../shields/shield-queue';

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
      listStatuses: await NodeStatus.getListStatuses(networkName),
      shieldQueueStatus: await getShieldQueueStatus(networkName),
    };
  }

  private static async getListStatuses(
    networkName: NetworkName,
  ): Promise<Record<string, POIListStatus>> {
    const allStatuses: Record<string, POIListStatus> = {};
    await Promise.all(
      Config.LIST_KEYS.map(async (listKey) => {
        const poiEvents = await POIEventList.getPOIEventsLength(
          networkName,
          listKey,
        );
        allStatuses[listKey] = {
          poiEvents,
          pendingTransactProofs: TransactProofMempoolCache.getCacheSize(
            listKey,
            networkName,
          ),
          blockedShields: BlockedShieldsCache.getCacheSize(
            listKey,
            networkName,
          ),
        };
      }),
    );
    return allStatuses;
  }
}
