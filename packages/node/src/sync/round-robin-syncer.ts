import {
  NetworkName,
  delay,
  isDefined,
} from '@railgun-community/shared-models';
import debug from 'debug';
import { Config } from '../config/config';
import { POINodeRequest } from '../api/poi-node-request';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { NodeStatusAllNetworks } from '../models/api-types';
import { POIEventList } from '../poi/poi-event-list';
import { QueryLimits } from '../config/query-limits';
import { ShieldProofMempool } from '../proof-mempool/shield-proof-mempool';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import { PollStatus } from '../models/general-types';
import { ShieldProofMempoolCache } from '../proof-mempool/shield-proof-mempool-cache';
import { TransactProofMempoolCache } from '../proof-mempool/transact-proof-mempool-cache';

const dbg = debug('poi:sync');

export class RoundRobinSyncer {
  private readonly connectedNodeURLs: string[] = [];

  private currentNodeIndex = 0;

  private pollStatus = PollStatus.IDLE;

  private listKeys: string[];

  constructor(connectedNodeURLs: string[], listKeys: string[]) {
    this.connectedNodeURLs = connectedNodeURLs;
    this.listKeys = listKeys;
  }

  getPollStatus(): PollStatus {
    return this.pollStatus;
  }

  startPolling() {
    if (this.connectedNodeURLs.length === 0) {
      dbg('No connected nodes - not polling.');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.poll();
  }

  private async poll() {
    const nodeURL = this.connectedNodeURLs[this.currentNodeIndex];

    try {
      const nodeStatusAllNetworks =
        await POINodeRequest.getNodeStatusAllNetworks(nodeURL);

      await this.updatePOIEventListAllNetworks(nodeURL, nodeStatusAllNetworks);
      dbg('Synced: POI Event Lists');

      await this.updateShieldProofMempoolsAllNetworks(
        nodeURL,
        nodeStatusAllNetworks,
      );
      dbg('Synced: Shield Proof Mempools');

      await this.updateTransactProofMempoolsAllNetworks(
        nodeURL,
        nodeStatusAllNetworks,
      );
      dbg('Synced: Transact Proof Mempools');

      await this.updateRailgunTxidMerkletreeValidatedRootAllNetworks(
        nodeURL,
        nodeStatusAllNetworks,
      );
      dbg('Synced: Railgun Validated TXID Merkletree Roots');

      this.pollStatus = PollStatus.POLLING;

      // 30 second delay before next poll
      await delay(30 * 1000);
    } catch (err) {
      dbg(`Error polling node ${nodeURL}: ${err.message}`);

      this.pollStatus = PollStatus.ERROR;

      // 5 second delay before next poll
      await delay(5 * 1000);
    } finally {
      this.incrementNodeIndex();

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.poll();
    }
  }

  private async updateRailgunTxidMerkletreeValidatedRootAllNetworks(
    nodeURL: string,
    nodeStatusAllNetworks: NodeStatusAllNetworks,
  ) {
    await Promise.all(
      Config.NETWORK_NAMES.map(async (networkName) => {
        const nodeStatus = nodeStatusAllNetworks.forNetwork[networkName];
        if (!nodeStatus) {
          dbg(`Node ${nodeURL} does not support network ${networkName}`);
          return;
        }
        await RailgunTxidMerkletreeManager.updateValidatedRailgunTxidStatusSafe(
          nodeURL,
          networkName,
          nodeStatus.txidStatus,
        );
      }),
    );
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
      const { eventListStatuses } = nodeStatus;

      for (const listKey of this.listKeys) {
        if (!isDefined(eventListStatuses[listKey])) {
          continue;
        }
        await this.updatePOIEventList(
          nodeURL,
          networkName,
          listKey,
          eventListStatuses[listKey].length,
        );
      }
    }
  }

  private async updatePOIEventList(
    nodeURL: string,
    networkName: NetworkName,
    listKey: string,
    nodeListLength: number,
  ) {
    const { length: currentListLength } = await POIEventList.getEventListStatus(
      networkName,
      listKey,
    );
    if (nodeListLength <= currentListLength) {
      return;
    }

    // Update up to 100 events from this list.
    const startIndex = currentListLength;
    const endIndex = Math.min(
      startIndex + QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH - 1,
      nodeListLength - 1,
    );

    const signedPOIEvents = await POINodeRequest.getPOIListEventRange(
      nodeURL,
      networkName,
      listKey,
      startIndex,
      endIndex,
    );

    await POIEventList.verifyAndAddSignedPOIEvents(
      networkName,
      listKey,
      signedPOIEvents,
    );

    dbg(
      `Synced ${signedPOIEvents.length} POI events to list ${listKey} for network ${networkName}`,
    );
  }

  private async updateShieldProofMempoolsAllNetworks(
    nodeURL: string,
    nodeStatusAllNetworks: NodeStatusAllNetworks,
  ) {
    for (const networkName of Config.NETWORK_NAMES) {
      const nodeStatus = nodeStatusAllNetworks.forNetwork[networkName];
      if (!nodeStatus) {
        continue;
      }
      await this.updateShieldProofMempool(nodeURL, networkName);
    }
  }

  private async updateShieldProofMempool(
    nodeURL: string,
    networkName: NetworkName,
  ) {
    const serializedBloomFilter =
      ShieldProofMempoolCache.serializeBloomFilter(networkName);
    const shieldProofs = await POINodeRequest.getFilteredShieldProofs(
      nodeURL,
      networkName,
      serializedBloomFilter,
    );
    for (const shieldProof of shieldProofs) {
      await ShieldProofMempool.submitProof(networkName, shieldProof);
    }
  }

  private async updateTransactProofMempoolsAllNetworks(
    nodeURL: string,
    nodeStatusAllNetworks: NodeStatusAllNetworks,
  ) {
    for (const networkName of Config.NETWORK_NAMES) {
      const nodeStatus = nodeStatusAllNetworks.forNetwork[networkName];
      if (!nodeStatus) {
        continue;
      }

      const nodeListKeys = nodeStatusAllNetworks.listKeys;
      const listKeys = Config.LIST_KEYS;

      for (const listKey of listKeys) {
        if (!nodeListKeys.includes(listKey)) {
          continue;
        }
        await this.updateTransactProofMempool(nodeURL, networkName, listKey);
      }
    }
  }

  private async updateTransactProofMempool(
    nodeURL: string,
    networkName: NetworkName,
    listKey: string,
  ) {
    const serializedBloomFilter =
      TransactProofMempoolCache.serializeBloomFilter(listKey, networkName);
    const transactProofs = await POINodeRequest.getFilteredTransactProofs(
      nodeURL,
      networkName,
      listKey,
      serializedBloomFilter,
    );
    for (const transactProof of transactProofs) {
      await TransactProofMempool.submitProof(
        listKey,
        networkName,
        transactProof,
      );
    }
  }

  private incrementNodeIndex() {
    this.currentNodeIndex += 1;
    this.currentNodeIndex %= this.connectedNodeURLs.length;
  }
}
