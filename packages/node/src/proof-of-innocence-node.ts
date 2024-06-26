import debug from 'debug';
import {
  initDatabases,
  initEngineAndScanTXIDs,
  initModules,
} from './init/init';
import { ListProvider } from './list-provider/list-provider';
import { API } from './api/api';
import { RoundRobinSyncer } from './sync/round-robin-syncer';
import { ConnectedNodeStartup } from './sync/connected-node-startup';
import { NodeConfig } from './models/general-types';
import { chainForNetwork, getListKeysFromNodeConfigs } from './config/general';
import { stopEngine } from './engine/engine-init';
import axios from 'axios';
import { TransactProofPushSyncer } from './sync/transact-proof-push-syncer';
import { ListProviderPOIEventQueue } from './list-provider/list-provider-poi-event-queue';
import { delay } from '@railgun-community/shared-models';
import { Config } from './config/config';
import { refreshBalances } from '@railgun-community/wallet';

const dbg = debug('poi:node');

// 5 minutes
const DEFAULT_RESCAN_HISTORY_DELAY_MSEC = 5 * 60 * 1000;

// Entry point for the Proof of Innocence node
export class ProofOfInnocenceNode {
  private running = false;

  private port: string;

  private host: string;

  private listProvider: Optional<ListProvider>;

  private listKeys: string[];

  private connectedNodeStartup: ConnectedNodeStartup;

  private roundRobinSyncer: RoundRobinSyncer;

  private api: API;

  constructor(
    host: string,
    port: string,
    nodeConfigs: NodeConfig[],
    listProvider?: ListProvider,
  ) {
    this.host = host;
    this.port = port;
    this.listProvider = listProvider;
    this.listKeys = getListKeysFromNodeConfigs(nodeConfigs);
    if (listProvider) {
      this.listKeys.push(listProvider.listKey);
    }
    this.connectedNodeStartup = new ConnectedNodeStartup(
      nodeConfigs,
      this.listKeys,
    );
    this.roundRobinSyncer = new RoundRobinSyncer(nodeConfigs, this.listKeys);
    this.api = new API(this.listKeys);
  }

  getURL() {
    return `http://${this.host}:${this.port}`;
  }

  async start() {
    if (this.running) {
      dbg(`ProofOfInnocenceNode already running, exiting start()`);
      return;
    }

    dbg(`ProofOfInnocenceNode start()...`);
    this.running = true;

    try {
      // Must proceed in this order:
      await initDatabases();
      dbg(`- Databases initialized -`);

      await initEngineAndScanTXIDs();
      dbg(`- Engine initialized -`);

      await this.connectedNodeStartup.start();
      dbg(`- Connected nodes started -`);

      await initModules(this.listKeys);
      dbg(`- Modules initialized -`);

      this.listProvider?.startPolling();
      dbg(`- List provider started polling -`);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.runRescanHistoryPoller();
      dbg(`- Rescan history poller started -`);

      this.api.serve(this.host, this.port);
      dbg(`- API started on ${this.getURL()} -`);

      this.roundRobinSyncer.startPolling();
      dbg(`- Round robin syncer started polling -`);

      const transactProofPushSyncer = new TransactProofPushSyncer(
        this.listKeys,
      );
      transactProofPushSyncer.startPolling();
      dbg(`- Transact proof push syncer started polling -`);

      // Check if node API is running
      const url = this.getURL();
      await axios.get(url, { timeout: 3000 });
      dbg(`- API check successful: Connected to ${url} -`);
    } catch (err) {
      dbg(`Error during node startup: ${err.message}`);
      throw err;
    }

    ListProviderPOIEventQueue.ready = true;
    dbg(`ProofOfInnocence node finished starting.`);
  }

  private async runRescanHistoryPoller() {
    dbg(`Rescan history poller started...`);

    for (const networkName of Config.NETWORK_NAMES) {
      const chain = chainForNetwork(networkName);
      await refreshBalances(chain, undefined);
    }

    await delay(DEFAULT_RESCAN_HISTORY_DELAY_MSEC);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.runRescanHistoryPoller();
  }

  async stop() {
    this.api.stop();
    await stopEngine();
  }

  getPollStatus() {
    return this.roundRobinSyncer.getPollStatus();
  }
}
