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
import { getListKeysFromNodeConfigs } from './config/general';
import { stopEngine } from './engine/engine-init';
import axios from 'axios';
import { TransactProofPushSyncer } from './sync/transact-proof-push-syncer';
import { ListProviderPOIEventQueue } from './list-provider/list-provider-poi-event-queue';

const dbg = debug('poi:node');

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
      return;
    }

    dbg(`Starting Proof of Innocence node...`);
    this.running = true;

    // Must proceed in this order:
    await initDatabases();
    await initEngineAndScanTXIDs();
    await this.connectedNodeStartup.start();
    await initModules(this.listKeys);

    this.listProvider?.startPolling();

    this.api.serve(this.host, this.port);

    this.roundRobinSyncer.startPolling();

    const transactProofPushSyncer = new TransactProofPushSyncer(this.listKeys);
    transactProofPushSyncer.startPolling();

    // Check if node API is running
    try {
      const url = this.getURL();
      await axios.get(url, { timeout: 1000 });
    } catch (err) {
      dbg(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Cannot connect to API - check port ${this.port} for existing process: ${err.message}`,
      );
    }

    ListProviderPOIEventQueue.ready = true;

    dbg(`Proof of Innocence node running...`);
  }

  async stop() {
    this.api.stop();
    await stopEngine();
  }

  getPollStatus() {
    return this.roundRobinSyncer.getPollStatus();
  }
}
