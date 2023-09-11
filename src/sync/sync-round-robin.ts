import { delay } from '@railgun-community/shared-models';
import debug from 'debug';
import { Config } from '../config/config';
import { POINodeRequest } from '../api/poi-node-request';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';

const dbg = debug('poi:sync');

export class SyncRoundRobin {
  static currentNodeIndex = 0;

  private static shouldPoll = false;

  static async startPolling() {
    SyncRoundRobin.shouldPoll = true;
  }

  static async stopPolling() {
    SyncRoundRobin.shouldPoll = false;
  }

  static async poll() {
    if (!SyncRoundRobin.shouldPoll) {
      return;
    }

    const node = Config.CONNECTED_NODES[SyncRoundRobin.currentNodeIndex];

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

    SyncRoundRobin.incrementNodeIndex();

    // 30 second delay before next poll
    await delay(30 * 1000);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    SyncRoundRobin.poll();
  }

  private static incrementNodeIndex() {
    SyncRoundRobin.currentNodeIndex += 1;
    SyncRoundRobin.currentNodeIndex %= Config.CONNECTED_NODES.length;
  }
}
