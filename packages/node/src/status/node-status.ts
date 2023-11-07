import {
  NetworkName,
  NodeStatusForNetwork,
  NodeStatusAllNetworks,
  POIListStatus,
  TXIDVersion,
} from '@railgun-community/shared-models';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { Config } from '../config/config';
import { POIEventList } from '../poi-events/poi-event-list';
import { TransactProofMempoolCache } from '../proof-mempool/transact-proof-mempool-cache';
import { BlockedShieldsCache } from '../shields/blocked-shields-cache';
import { getShieldQueueStatus } from '../shields/shield-queue';
import { LegacyTransactProofMempool } from '../proof-mempool/legacy/legacy-transact-proof-mempool';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';

export class NodeStatus {
  static async getNodeStatusAllNetworks(
    listKeys: string[],
    txidVersion: TXIDVersion,
  ): Promise<NodeStatusAllNetworks> {
    const statusForNetwork: Partial<Record<NetworkName, NodeStatusForNetwork>> =
      {};
    const allNetworks: NetworkName[] = Object.values(Config.NETWORK_NAMES);
    await Promise.all(
      allNetworks.map(async networkName => {
        statusForNetwork[networkName] = await NodeStatus.getNodeStatus(
          networkName,
          txidVersion,
          listKeys,
        );
      }),
    );
    return {
      forNetwork: statusForNetwork,
      listKeys,
    };
  }

  private static async getNodeStatus(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKeys: string[],
  ): Promise<NodeStatusForNetwork> {
    return {
      txidStatus: await RailgunTxidMerkletreeManager.getRailgunTxidStatus(
        networkName,
        txidVersion,
      ),
      listStatuses: await NodeStatus.getListStatuses(
        networkName,
        txidVersion,
        listKeys,
      ),
      shieldQueueStatus: await getShieldQueueStatus(networkName, txidVersion),
      legacyTransactProofs:
        LegacyTransactProofMempool.getLegacyTransactProofsCount(
          networkName,
          txidVersion,
        ),
    };
  }

  private static async getListStatuses(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKeys: string[],
  ): Promise<Record<string, POIListStatus>> {
    const allStatuses: Record<string, POIListStatus> = {};
    await Promise.all(
      listKeys.map(async listKey => {
        const poiEventLengths = await POIEventList.getPOIEventLengths(
          listKey,
          networkName,
          txidVersion,
        );
        allStatuses[listKey] = {
          poiEventLengths,
          pendingTransactProofs: TransactProofMempoolCache.getCacheSize(
            listKey,
            networkName,
            txidVersion,
          ),
          blockedShields: BlockedShieldsCache.getCacheSize(
            listKey,
            networkName,
            txidVersion,
          ),
          historicalMerklerootsLength:
            await POIMerkletreeManager.getHistoricalPOIMerklerootsCount(
              txidVersion,
              networkName,
              listKey,
            ),
          latestHistoricalMerkleroot:
            (await POIMerkletreeManager.getLatestPOIMerkleroot(
              txidVersion,
              networkName,
              listKey,
            )) ?? 'No merkleroot found',
        };
      }),
    );
    return allStatuses;
  }
}
