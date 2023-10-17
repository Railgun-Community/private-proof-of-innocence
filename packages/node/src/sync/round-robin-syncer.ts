import {
  NetworkName,
  delay,
  isDefined,
  NodeStatusAllNetworks,
  TXIDVersion,
  POIEventLengths,
} from '@railgun-community/shared-models';
import debug from 'debug';
import { Config } from '../config/config';
import { POINodeRequest } from '../api/poi-node-request';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { POIEventList } from '../poi-events/poi-event-list';
import { QueryLimits } from '../config/query-limits';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import { NodeConfig, PollStatus } from '../models/general-types';
import { TransactProofMempoolCache } from '../proof-mempool/transact-proof-mempool-cache';
import { BlockedShieldsCache } from '../shields/blocked-shields-cache';
import { BlockedShieldsSyncer } from '../shields/blocked-shields-syncer';
import { getListKeysFromNodeConfigs } from '../config/general';
import { LegacyTransactProofMempoolCache } from '../proof-mempool/legacy/legacy-transact-proof-mempool-cache';
import { LegacyTransactProofMempool } from '../proof-mempool/legacy/legacy-transact-proof-mempool';

const dbg = debug('poi:sync');

export class RoundRobinSyncer {
  private readonly nodeConfigs: NodeConfig[] = [];

  private currentNodeIndex = 0;

  private pollStatus = PollStatus.IDLE;

  private listKeys: string[];

  private syncCount = 0;

  constructor(nodeConfigs: NodeConfig[]) {
    this.nodeConfigs = nodeConfigs;
    this.listKeys = getListKeysFromNodeConfigs(nodeConfigs);
  }

  getPollStatus(): PollStatus {
    return this.pollStatus;
  }

  startPolling() {
    if (this.nodeConfigs.length === 0) {
      dbg('No connected nodes - not polling.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.poll();
  }

  private async poll() {
    const { nodeURL } = this.nodeConfigs[this.currentNodeIndex];

    try {
      const nodeStatusAllNetworks =
        await POINodeRequest.getNodeStatusAllNetworks(nodeURL);

      dbg('');
      dbg(`-- Syncing with ${nodeURL} -- `);

      await this.updatePOIEventListAllNetworks(nodeURL, nodeStatusAllNetworks);

      await this.updateTransactProofMempoolsAllNetworks(
        nodeURL,
        nodeStatusAllNetworks,
      );

      await this.updateRailgunTxidMerkletreeValidatedRootAllNetworks(
        nodeURL,
        nodeStatusAllNetworks,
      );

      await this.updateBlockedShieldsAllNetworks(
        nodeURL,
        nodeStatusAllNetworks,
      );

      if (this.syncCount % 47) {
        // Every 11.5 min or so...
        // It will be very rare for this to have an un-synced update.
        await this.updateLegacyTransactProofMempoolsAllNetworks(
          nodeURL,
          nodeStatusAllNetworks,
        );
      }
      dbg('');

      this.pollStatus = PollStatus.POLLING;
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(`Error polling node ${nodeURL}: ${err.message}`);
    } finally {
      this.incrementNodeIndex();
      this.syncCount += 1;

      // 15 second delay before next poll
      await delay(15 * 1000);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.poll();
    }
  }

  private async updateRailgunTxidMerkletreeValidatedRootAllNetworks(
    nodeURL: string,
    nodeStatusAllNetworks: NodeStatusAllNetworks,
  ) {
    for (const networkName of Config.NETWORK_NAMES) {
      const nodeStatus = nodeStatusAllNetworks.forNetwork[networkName];
      if (!nodeStatus) {
        dbg(`Node ${nodeURL} does not support network ${networkName}`);
        return;
      }
      for (const txidVersion of Config.TXID_VERSIONS) {
        try {
          await RailgunTxidMerkletreeManager.updateValidatedRailgunTxidStatusSafe(
            nodeURL,
            networkName,
            txidVersion,
            nodeStatus.txidStatus,
          );
        } catch (err) {
          dbg(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Error syncing railgun txid merkletree validated root for network ${networkName}: ${err.message}`,
          );
        }
      }
    }
  }

  async updatePOIEventListAllNetworks(
    nodeURL: string,
    nodeStatusAllNetworks: NodeStatusAllNetworks,
  ) {
    for (const networkName of Config.NETWORK_NAMES) {
      const nodeStatus = nodeStatusAllNetworks.forNetwork[networkName];
      if (!nodeStatus) {
        continue;
      }
      const { listStatuses } = nodeStatus;

      for (const txidVersion of Config.TXID_VERSIONS) {
        for (const listKey of this.listKeys) {
          if (!isDefined(listStatuses[listKey])) {
            continue;
          }
          try {
            await this.updatePOIEventList(
              nodeURL,
              networkName,
              txidVersion,
              listKey,
              listStatuses[listKey].poiEventLengths,
            );
          } catch (err) {
            dbg(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              `Error syncing POI events for list ${listKey} on network ${networkName}: ${err.message}`,
            );
          }
        }
      }
    }
  }

  private async updatePOIEventList(
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    nodePOIEventLengths: POIEventLengths,
  ) {
    const currentListLength = await POIEventList.getOverallEventsLength(
      listKey,
      networkName,
      txidVersion,
    );
    if (
      POIEventList.getTotalEventsLength(nodePOIEventLengths) <=
      currentListLength
    ) {
      return;
    }

    // Update a range of events from this list.
    const startIndex = currentListLength;
    const endIndex = startIndex + QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH - 1;

    const signedPOIEvents = await POINodeRequest.getPOIListEventRange(
      nodeURL,
      networkName,
      txidVersion,
      listKey,
      startIndex,
      endIndex,
    );

    dbg(
      `Syncing ${signedPOIEvents.length} POI events to list ${listKey} for network ${networkName}`,
    );

    await POIEventList.verifyAndAddSignedPOIEvents(
      listKey,
      networkName,
      txidVersion,
      signedPOIEvents,
    );
  }

  async updateTransactProofMempoolsAllNetworks(
    nodeURL: string,
    nodeStatusAllNetworks: NodeStatusAllNetworks,
  ) {
    for (const networkName of Config.NETWORK_NAMES) {
      const nodeStatus = nodeStatusAllNetworks.forNetwork[networkName];
      if (!nodeStatus) {
        continue;
      }

      const { listStatuses } = nodeStatus;

      for (const txidVersion of Config.TXID_VERSIONS) {
        for (const listKey of this.listKeys) {
          if (!isDefined(listStatuses[listKey])) {
            continue;
          }
          try {
            await this.updateTransactProofMempool(
              nodeURL,
              networkName,
              txidVersion,
              listKey,
              listStatuses[listKey].pendingTransactProofs,
            );
          } catch (err) {
            dbg(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              `Error syncing transact proofs for list ${listKey} on network ${networkName}: ${err.message}`,
            );
          }
        }
      }
    }
  }

  private async updateTransactProofMempool(
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    nodePendingTransactProofsLength: number,
  ) {
    const currentTransactProofsLength = TransactProofMempoolCache.getCacheSize(
      listKey,
      networkName,
      txidVersion,
    );
    if (nodePendingTransactProofsLength <= currentTransactProofsLength) {
      return;
    }

    const serializedBloomFilter =
      TransactProofMempoolCache.serializeBloomFilter(
        listKey,
        networkName,
        txidVersion,
      );
    const transactProofs = await POINodeRequest.getFilteredTransactProofs(
      nodeURL,
      networkName,
      txidVersion,
      listKey,
      serializedBloomFilter,
    );

    dbg(
      `Syncing ${transactProofs.length} transact proofs to list ${listKey} for network ${networkName}`,
    );

    for (const transactProof of transactProofs) {
      try {
        await TransactProofMempool.submitProof(
          listKey,
          networkName,
          txidVersion,
          transactProof,
        );
      } catch (err) {
        dbg(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Error submitting transact proof to mempool for list ${listKey} on network ${networkName}: ${err.message}`,
        );
      }
    }
  }

  async updateLegacyTransactProofMempoolsAllNetworks(
    nodeURL: string,
    nodeStatusAllNetworks: NodeStatusAllNetworks,
  ) {
    for (const networkName of Config.NETWORK_NAMES) {
      const nodeStatusForNetwork =
        nodeStatusAllNetworks.forNetwork[networkName];
      if (!nodeStatusForNetwork) {
        continue;
      }

      for (const txidVersion of Config.TXID_VERSIONS) {
        try {
          await this.updateLegacyTransactProofMempool(
            nodeURL,
            networkName,
            txidVersion,
            nodeStatusForNetwork.legacyTransactProofs,
          );
        } catch (err) {
          dbg(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Error syncing legacy transact proofs on network ${networkName}: ${err.message}`,
          );
        }
      }
    }
  }

  private async updateLegacyTransactProofMempool(
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    nodeLegacyTransactProofsLength: number,
  ) {
    const currentLegacyTransactProofsLength =
      LegacyTransactProofMempoolCache.getCacheSize(networkName, txidVersion);
    if (nodeLegacyTransactProofsLength <= currentLegacyTransactProofsLength) {
      return;
    }

    const serializedBloomFilter =
      LegacyTransactProofMempoolCache.serializeBloomFilter(
        networkName,
        txidVersion,
      );
    const legacyTransactProofs =
      await POINodeRequest.getFilteredLegacyTransactProofs(
        nodeURL,
        networkName,
        txidVersion,
        serializedBloomFilter,
      );

    dbg(
      `Syncing ${legacyTransactProofs.length} legacy transact proofs for network ${networkName}`,
    );

    for (const legacyTransactProof of legacyTransactProofs) {
      try {
        await LegacyTransactProofMempool.submitLegacyProof(
          networkName,
          txidVersion,
          legacyTransactProof,
          [], // listKeysForPush
        );
      } catch (err) {
        dbg(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Error submitting legacy transact proof to mempool on network ${networkName}: ${err.message}`,
        );
      }
    }
  }

  async updateBlockedShieldsAllNetworks(
    nodeURL: string,
    nodeStatusAllNetworks: NodeStatusAllNetworks,
  ) {
    for (const networkName of Config.NETWORK_NAMES) {
      const nodeStatus = nodeStatusAllNetworks.forNetwork[networkName];
      if (!nodeStatus) {
        continue;
      }
      const { listStatuses } = nodeStatus;

      for (const txidVersion of Config.TXID_VERSIONS) {
        for (const listKey of this.listKeys) {
          if (!isDefined(listStatuses[listKey])) {
            continue;
          }
          try {
            await this.updateBlockedShields(
              nodeURL,
              networkName,
              txidVersion,
              listKey,
              listStatuses[listKey].blockedShields,
            );
          } catch (err) {
            dbg(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              `Error syncing blocked shields for list ${listKey} on network ${networkName}: ${err.message}`,
            );
          }
        }
      }
    }
  }

  private async updateBlockedShields(
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    nodeBlockedShieldsLength: number,
  ) {
    const currentBlockedShieldsLength = BlockedShieldsCache.getBlockedShields(
      listKey,
      networkName,
      txidVersion,
    ).length;
    if (nodeBlockedShieldsLength <= currentBlockedShieldsLength) {
      return;
    }

    const serializedBloomFilter = BlockedShieldsCache.serializeBloomFilter(
      listKey,
      networkName,
      txidVersion,
    );
    const signedBlockedShields = await POINodeRequest.getFilteredBlockedShields(
      nodeURL,
      networkName,
      txidVersion,
      listKey,
      serializedBloomFilter,
    );

    dbg(
      `Syncing ${signedBlockedShields.length} blocked shields to list ${listKey} for network ${networkName}`,
    );

    for (const signedBlockedShield of signedBlockedShields) {
      try {
        await BlockedShieldsSyncer.addSignedBlockedShield(
          listKey,
          networkName,
          txidVersion,
          signedBlockedShield,
        );
      } catch (err) {
        dbg(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          `Error adding blocked shield for list ${listKey} on network ${networkName}: ${err.message}`,
        );
      }
    }
  }

  private incrementNodeIndex() {
    this.currentNodeIndex += 1;
    this.currentNodeIndex %= this.nodeConfigs.length;
  }
}
