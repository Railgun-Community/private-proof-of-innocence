import debug from 'debug';
import { startExpressAPIServer } from './api/api';
import { initModules, uninitModules } from './init/init';
import { ListProvider } from './list-provider/list-provider';

const dbg = debug('poi:node');

export class ProofOfInnocenceNode {
  private running = false;

  private listProvider: ListProvider;

  constructor(listProvider: ListProvider) {
    this.listProvider = listProvider;
  }

  async start() {
    if (this.running) {
      return;
    }
    dbg(`Starting Proof of Innocence node...`);

    this.running = true;
    startExpressAPIServer();

    await initModules();

    await this.listProvider.startPolling();

    dbg(`Proof of Innocence node running...`);
  }

  async stop() {
    dbg(`Stopping Proof of Innocence node...`);

    await uninitModules();
    await this.listProvider?.stopPolling();
    this.running = false;

    dbg(`Proof of Innocence node stopped.`);
  }
}
