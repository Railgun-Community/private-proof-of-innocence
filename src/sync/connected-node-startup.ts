import debug from 'debug';
import { PollStatus } from '../models/general-types';

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

    // TODO: Ensure that we can connected to nodes.

    // TODO: Ensure connected nodes are running the same network and lists.

    // TODO: Set 'updateMinimumNextAddIndex' for current list.
  }
}
