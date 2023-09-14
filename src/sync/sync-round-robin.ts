import { delay } from '@railgun-community/shared-models';
import debug from 'debug';
import { Config } from '../config/config';
import { POINodeRequest } from '../api/poi-node-request';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';

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

    const node =
      SyncRoundRobin.connectedNodeURLs[SyncRoundRobin.currentNodeIndex];

    try {
      const nodeStatusAllNetworks =
        await POINodeRequest.getNodeStatusAllNetworks(node);

      await Promise.all(
        Config.NETWORK_NAMES.map(async (networkName) => {
          const nodeStatus = nodeStatusAllNetworks[networkName];
          if (!nodeStatus) {
            dbg(`Node ${node} does not support network ${networkName}`);
            return;
          }
          await RailgunTxidMerkletreeManager.updateValidatedRailgunTxidStatus(
            node,
            networkName,
            nodeStatus.txidStatus,
          );
        }),
      );

      // 30 second delay before next poll
      await delay(30 * 1000);
    } catch (err) {
      dbg(`Error polling node ${node}: ${err.message}`);

      // 5 second delay before next poll
      await delay(5 * 1000);
    } finally {
      SyncRoundRobin.incrementNodeIndex();

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      SyncRoundRobin.poll();
    }
  }

  private static incrementNodeIndex() {
    SyncRoundRobin.currentNodeIndex += 1;
    SyncRoundRobin.currentNodeIndex %= SyncRoundRobin.connectedNodeURLs.length;
  }
}
