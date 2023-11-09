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
import { LegacyTransactProofMempoolCache } from '../proof-mempool/legacy/legacy-transact-proof-mempool-cache';
import { LegacyTransactProofMempool } from '../proof-mempool/legacy/legacy-transact-proof-mempool';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';

const dbg = debug('poi:sync');

export class RoundRobinSyncer {
  private readonly nodeConfigs: NodeConfig[] = [];

  private currentNodeIndex = 0;

  private pollStatus = PollStatus.IDLE;

  private listKeys: string[];

  private syncCount = 0;

  constructor(nodeConfigs: NodeConfig[], listKeys: string[]) {
    this.nodeConfigs = nodeConfigs;
    this.listKeys = listKeys;
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

    let shouldDelayNextPoll = true;

    try {
      const nodeStatusAllNetworks =
        await POINodeRequest.getNodeStatusAllNetworks(nodeURL);

      dbg('');
      dbg(`-- 🔁 Syncing with ${nodeURL} 🔁 -- `);

      const totalEventsSynced = await this.updatePOIEventListAllNetworks(
        nodeURL,
        nodeStatusAllNetworks,
      );
      if (totalEventsSynced > 200) {
        shouldDelayNextPoll = false;
      }

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

      if (shouldDelayNextPoll) {
        // 5 second delay before next poll
        await delay(5 * 1000);
      }

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
  ): Promise<number> {
    let totalEventsSynced = 0;

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
            const eventsSynced = await this.updatePOIEventList(
              nodeURL,
              networkName,
              txidVersion,
              listKey,
              listStatuses[listKey].poiEventLengths,
            );
            totalEventsSynced += eventsSynced;
          } catch (err) {
            dbg(
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              `Error syncing POI events for list ${listKey} on network ${networkName}: ${err.message}`,
            );
          }
        }
      }
    }

    return totalEventsSynced;
  }

  private async updatePOIEventList(
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    nodePOIEventLengths: POIEventLengths,
  ): Promise<number> {
    const currentListLength = await POIEventList.getOverallEventsLength(
      listKey,
      networkName,
      txidVersion,
    );

    const nodeTotalEventsLength =
      POIEventList.getTotalEventsLength(nodePOIEventLengths);

    if (nodeTotalEventsLength <= currentListLength) {
      return 0;
    }

    const totalPOIMerkletreeEvents =
      await POIMerkletreeManager.getTotalEventsAllPOIMerkletrees(
        listKey,
        networkName,
        txidVersion,
      );

    if (currentListLength !== totalPOIMerkletreeEvents) {
      // Check for any missing events that are already added to merkletree
      const missingEventIndices = await POIEventList.getMissingEventIndices(
        listKey,
        networkName,
        txidVersion,
      );
      for (const missingEventIndex of missingEventIndices) {
        dbg(`Syncing single missing event: index ${missingEventIndex}`);
        await this.addPOIListEventRange(
          nodeURL,
          networkName,
          txidVersion,
          listKey,
          missingEventIndex, // startIndex
          missingEventIndex, // endIndex
        );
      }
    }

    // Update a range of events from this list.
    const startIndex = currentListLength;
    const endIndex = Math.min(
      startIndex + QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH - 1,
      nodeTotalEventsLength - 1,
    );

    return this.addPOIListEventRange(
      nodeURL,
      networkName,
      txidVersion,
      listKey,
      startIndex,
      endIndex,
    );
  }

  async addPOIListEventRange(
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    startIndex: number,
    endIndex: number,
  ): Promise<number> {
    const poiSyncedListEvents = await POINodeRequest.getPOIListEventRange(
      nodeURL,
      networkName,
      txidVersion,
      listKey,
      startIndex,
      endIndex,
    );

    dbg(
      `Syncing ${poiSyncedListEvents.length} POI events to list ${listKey} for network ${networkName}`,
    );

    await POIEventList.verifyAndAddSignedPOIEventsWithValidatedMerkleroots(
      listKey,
      networkName,
      txidVersion,
      poiSyncedListEvents,
    );
    return poiSyncedListEvents.length;
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
