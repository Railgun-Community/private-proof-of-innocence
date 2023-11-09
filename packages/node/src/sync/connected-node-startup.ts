import debug from 'debug';
import { NodeConfig } from '../models/general-types';
import { POINodeRequest } from '../api/poi-node-request';
import { Config } from '../config/config';
import { NetworkName } from '@railgun-community/shared-models';
import { ListProviderPOIEventQueue } from '../list-provider/list-provider-poi-event-queue';
import { POIEventList } from '../poi-events/poi-event-list';

const dbg = debug('poi:connected-node-startup');

export class ConnectedNodeStartup {
  private readonly nodeConfigs: NodeConfig[];

  private readonly listKeys: string[];

  constructor(nodeConfigs: NodeConfig[], listKeys: string[]) {
    this.nodeConfigs = nodeConfigs;
    this.listKeys = listKeys;
  }

  async start() {
    if (this.nodeConfigs.length === 0) {
      dbg('No connected nodes - nothing to start up.');
      return;
    }

    dbg('Making initial connection to nodes...');

    await Promise.all(
      this.nodeConfigs.map(async ({ nodeURL }) => {
        try {
          dbg(`Connecting to node ${nodeURL}...`);

          const nodeStatusAllNetworks =
            await POINodeRequest.getNodeStatusAllNetworks(nodeURL);

          // Check here if connection is successful and node is responding to requests

          // Check all list keys
          this.listKeys.forEach(listKey => {
            if (!nodeStatusAllNetworks.listKeys.includes(listKey)) {
              dbg(`Local list key ${listKey} not found on node ${nodeURL}`);
            }
          });
          nodeStatusAllNetworks.listKeys.forEach(listKey => {
            if (!this.listKeys.includes(listKey)) {
              dbg(
                `Foreign list key ${listKey} from node ${nodeURL} not found locally`,
              );
            }
          });

          // Check all networks
          Config.NETWORK_NAMES.forEach(networkName => {
            if (
              !Object.keys(nodeStatusAllNetworks.forNetwork).includes(
                networkName,
              )
            ) {
              dbg(`Local network ${networkName} not found on node ${nodeURL}`);
            }
          });
          Object.keys(nodeStatusAllNetworks.forNetwork).forEach(networkName => {
            if (!Config.NETWORK_NAMES.includes(networkName as NetworkName)) {
              dbg(
                `Foreign list key ${networkName} from node ${nodeURL} not found locally`,
              );
            }
          });

          // The "minimum next add index" ensures that no connected nodes have a more-updated list than this node.
          // If they do, this node will wait to add new events until it's synced.
          dbg(`Updating minimum next add index...`);

          const listKey = ListProviderPOIEventQueue.listKey;
          for (const networkName of Config.NETWORK_NAMES) {
            const poiEventLengths =
              nodeStatusAllNetworks.forNetwork[networkName]?.listStatuses?.[
                listKey
              ]?.poiEventLengths;
            const eventListLength = poiEventLengths
              ? POIEventList.getTotalEventsLength(poiEventLengths)
              : 0;
            const syncedIndex = eventListLength;
            dbg(
              `Minimum next-add index: ${listKey} ${networkName} ${syncedIndex}`,
            );

            ListProviderPOIEventQueue.tryUpdateMinimumNextAddIndex(
              listKey,
              networkName,
              syncedIndex,
            );
            dbg(
              `Updated minimum next-add index: ${listKey} ${networkName} ${syncedIndex}`,
            );
          }
        } catch (err) {
          dbg(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            `Error initially connecting and getting node status from ${nodeURL}: ${err.message}`,
          );
        }
      }),
    );
  }
}
