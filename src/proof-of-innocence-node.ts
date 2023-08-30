import { startExpressAPIServer } from './api/api';
import { initModules, uninitModules } from './init/init';
import { ListProvider } from './list-provider/list-provider';

export class ProofOfInnocenceNode {
  private running = false;

  private listProviders: ListProvider[] = [];

  async start(listProviders: ListProvider[]) {
    if (this.running) {
      return;
    }
    this.running = true;
    this.listProviders = listProviders;
    startExpressAPIServer();
    await initModules();
    await Promise.all(listProviders.map((lp) => lp.startPolling()));
  }

  async stop() {
    await uninitModules();
    await Promise.all(this.listProviders.map((lp) => lp.stopPolling()));
    this.running = false;
  }
}
