import { NetworkName, delay } from '@railgun-community/shared-models';
import debug from 'debug';
import { Config } from '../config/config';
import { POINodeRequest } from '../api/poi-node-request';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { NodeStatusAllNetworks } from '../models/api-types';
import { POIEventList } from '../poi/poi-event-list';
import { QueryLimits } from '../config/query-limits';

const dbg = debug('poi:sync');

export class SyncRoundRobin {
  private static currentNodeIndex = 0;

  private static connectedNodeURLs: string[] = [];

  private static shouldPoll = false;

  static addNodeURL(nodeURL: string) {
    SyncRoundRobin.connectedNodeURLs.push(nodeURL);
  }

  static startPolling() {
    SyncRoundRobin.shouldPoll = true;

    if (SyncRoundRobin.connectedNodeURLs.length === 0) {
      throw new Error(
        'Must list at least one node to sync. Set Config.CONNECTED_NODES.',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    SyncRoundRobin.poll();
  }

  static stopPolling() {
    SyncRoundRobin.shouldPoll = false;
  }

  private static async poll() {
    if (!SyncRoundRobin.shouldPoll) {
      return;
    }

    const nodeURL =
      SyncRoundRobin.connectedNodeURLs[SyncRoundRobin.currentNodeIndex];

    try {
      const nodeStatusAllNetworks =
        await POINodeRequest.getNodeStatusAllNetworks(nodeURL);

      await SyncRoundRobin.updatePOIEventListAllNetworks(
        nodeURL,
        nodeStatusAllNetworks,
      );
      await SyncRoundRobin.updateRailgunTxidMerkletreeValidatedStatusAllNetworks(
        nodeURL,
        nodeStatusAllNetworks,
      );

      // 30 second delay before next poll
      await delay(30 * 1000);
    } catch (err) {
      dbg(`Error polling node ${nodeURL}: ${err.message}`);

      // 5 second delay before next poll
      await delay(5 * 1000);
    } finally {
      SyncRoundRobin.incrementNodeIndex();

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      SyncRoundRobin.poll();
    }
  }

  private static async updateRailgunTxidMerkletreeValidatedStatusAllNetworks(
    nodeURL: string,
    nodeStatusAllNetworks: NodeStatusAllNetworks,
  ) {
    await Promise.all(
      Config.NETWORK_NAMES.map(async (networkName) => {
        const nodeStatus = nodeStatusAllNetworks[networkName];
        if (!nodeStatus) {
          dbg(`Node ${nodeURL} does not support network ${networkName}`);
          return;
        }
        await RailgunTxidMerkletreeManager.updateValidatedRailgunTxidStatus(
          nodeURL,
          networkName,
          nodeStatus.txidStatus,
        );
      }),
    );
  }

  private static async updatePOIEventListAllNetworks(
    nodeURL: string,
    nodeStatusAllNetworks: NodeStatusAllNetworks,
  ) {
    for (const networkName of Config.NETWORK_NAMES) {
      const nodeStatus = nodeStatusAllNetworks[networkName];
      if (!nodeStatus) {
        return;
      }
      const { eventListStatuses } = nodeStatus;
      const listKeys = Object.keys(eventListStatuses);

      for (const listKey of listKeys) {
        await SyncRoundRobin.updatePOIEventList(
          nodeURL,
          networkName,
          listKey,
          eventListStatuses[listKey].length,
        );
      }
    }
  }

  private static async updatePOIEventList(
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
  }

  private static incrementNodeIndex() {
    SyncRoundRobin.currentNodeIndex += 1;
    SyncRoundRobin.currentNodeIndex %= SyncRoundRobin.connectedNodeURLs.length;
  }
}
