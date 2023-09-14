import debug from 'debug';
import { initModules, uninitModules } from './init/init';
import { ListProvider } from './list-provider/list-provider';
import { API } from './api/api';
import { RoundRobinSyncer } from './sync/round-robin-syncer';

const dbg = debug('poi:node');

// Entry point for the Proof of Innocence node
export class ProofOfInnocenceNode {
  private running = false;

  private port: string;

  private host: string;

  private listProvider: Optional<ListProvider>;

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
    this.roundRobinSyncer = new RoundRobinSyncer(connectedNodeURLs);
    this.api = new API();
  }

  async start() {
    if (this.running) {
      return;
    }
    dbg(`Starting Proof of Innocence node...`);

    this.running = true;

    await initModules();

    await this.listProvider?.init();
    this.listProvider?.startPolling();

    this.api.serve(this.host, this.port);

    this.roundRobinSyncer.startPolling();

    dbg(`Proof of Innocence node running...`);
  }

  async stop() {
    dbg(`Stopping Proof of Innocence node...`);

    this.api?.stop();

    await uninitModules();
    this.listProvider?.stopPolling();

    this.roundRobinSyncer.stopPolling();

    this.running = false;

    dbg(`Proof of Innocence node stopped.`);
  }

  getPollStatus() {
    return this.roundRobinSyncer.getPollStatus();
  }
}
