import { NetworkName, delay } from '@railgun-community/shared-models';
import debug from 'debug';
import { Config } from '../config/config';
import { ListProviderPOIEventQueue } from './list-provider-poi-event-queue';
import { ShieldProofMempool } from '../proof-mempool/shield-proof-mempool';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';

const dbg = debug('poi:event-updater');

export class ListProviderPOIEventUpdater {
  private shouldPoll = false;

  private listKey: string;

  private queue: ListProviderPOIEventQueue;

  constructor(listKey: string, queue: ListProviderPOIEventQueue) {
    this.listKey = listKey;
    this.queue = queue;
  }

  startPolling() {
    this.shouldPoll = true;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.poll();
  }

  stopPolling() {
    this.shouldPoll = false;
  }

  async poll() {
    if (!this.shouldPoll) {
      return;
    }

    for (const networkName of Config.NETWORK_NAMES) {
      await this.addPOIEventsForShields(networkName);
      await this.addPOIEventsForTransacts(networkName);
    }

    // Run every 30 minutes
    await delay(30 * 60 * 1000);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.poll();
  }

  async addPOIEventsForShields(networkName: NetworkName) {
    const shieldQueueDB = new ShieldQueueDatabase(networkName);
    const allowedShieldsStream = await shieldQueueDB.streamAllowedShields();

    for await (const { hash } of allowedShieldsStream) {
      const shieldProofData =
        await ShieldProofMempool.getShieldProofDataForCommitmentHash(
          networkName,
          hash,
        );
      if (shieldProofData) {
        this.queue.queueUnsignedPOIShieldEvent(networkName, shieldProofData);
      }
    }
  }

  async addPOIEventsForTransacts(networkName: NetworkName) {}
}
