import debug from 'debug';
import { PollStatus } from '../models/general-types';
import { POINodeRequest } from '../api/poi-node-request';
import { Config } from '../config/config';
import { NetworkName } from '@railgun-community/shared-models';
import { ListProviderPOIEventQueue } from '../list-provider/list-provider-poi-event-queue';

const dbg = debug('poi:connected-node-startup');

export class ConnectedNodeStartup {
  private readonly connectedNodeURLs: string[] = [];

  private pollStatus = PollStatus.IDLE;

  constructor(connectedNodeURLs: string[]) {
    this.connectedNodeURLs = connectedNodeURLs;
  }

  async start() {
    if (this.connectedNodeURLs.length === 0) {
      dbg('No connected nodes - nothing to start up.');
      return;
    }

    await Promise.all(
      this.connectedNodeURLs.map(async (nodeURL) => {
        const nodeStatusAllNetworks =
          await POINodeRequest.getNodeStatusAllNetworks(nodeURL);

        // Check all list keys
        Config.LIST_KEYS.forEach((listKey) => {
          if (!nodeStatusAllNetworks.listKeys.includes(listKey)) {
            dbg(`Local list key ${listKey} not found on node ${nodeURL}`);
          }
        });
        nodeStatusAllNetworks.listKeys.forEach((listKey) => {
          if (!Config.LIST_KEYS.includes(listKey)) {
            dbg(
              `Foreign list key ${listKey} from node ${nodeURL} not found locally`,
            );
          }
        });

        // Check all networks
        Config.NETWORK_NAMES.forEach((networkName) => {
          if (
            !Object.keys(nodeStatusAllNetworks.forNetwork).includes(networkName)
          ) {
            dbg(`Local network ${networkName} not found on node ${nodeURL}`);
          }
        });
        Object.keys(nodeStatusAllNetworks.forNetwork).forEach((networkName) => {
          if (!Config.NETWORK_NAMES.includes(networkName as NetworkName)) {
            dbg(
              `Foreign list key ${networkName} from node ${nodeURL} not found locally`,
            );
          }
        });

        // The "minimum next add index" ensures that no connected nodes have a more-updated list than this node.
        // If they do, this node will wait to add new events until it's synced.
        for (const networkName of Config.NETWORK_NAMES) {
          for (const listKey of Config.LIST_KEYS) {
            const eventListLength =
              nodeStatusAllNetworks.forNetwork[networkName]?.listStatuses?.[
                listKey
              ]?.poiEvents ?? 0;
            const syncedIndex = eventListLength - 1;
            ListProviderPOIEventQueue.updateMinimumNextAddIndex(
              networkName,
              syncedIndex,
            );
          }
        }
      }),
    );
  }
}
