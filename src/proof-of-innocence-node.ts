import debug from 'debug';
import { initModules, uninitModules } from './init/init';
import { ListProvider } from './list-provider/list-provider';
import { API } from './api/api';
import { RoundRobinSyncer } from './sync/round-robin-syncer';
import { ConnectedNodeStartup } from './sync/connected-node-startup';

const dbg = debug('poi:node');

export class ProofOfInnocenceNode {
  private running = false;

  private port: string;

  private host: string;

  private listProvider: Optional<ListProvider>;

  private connectedNodeStartup: ConnectedNodeStartup;

  private roundRobinSyncer: RoundRobinSyncer;

  private api: API;

  constructor(
    host: string,
    port: string,
    connectedNodeURLs: string[],
    listProvider?: ListProvider,
  ) {
    this.host = host;
    this.port = port;
    this.listProvider = listProvider;
    this.connectedNodeStartup = new ConnectedNodeStartup(connectedNodeURLs);
    this.roundRobinSyncer = new RoundRobinSyncer(connectedNodeURLs);
    this.api = new API();
  }

  async start() {
    if (this.running) {
      return;
    }
    dbg(`Starting Proof of Innocence node...`);

    this.running = true;

    await this.connectedNodeStartup.start();

    await initModules();

    await this.listProvider?.startPolling();

    this.api.serve(this.host, this.port);

    this.roundRobinSyncer.startPolling();

    dbg(`Proof of Innocence node running...`);
  }

  getPollStatus() {
    return this.roundRobinSyncer.getPollStatus();
  }
}
