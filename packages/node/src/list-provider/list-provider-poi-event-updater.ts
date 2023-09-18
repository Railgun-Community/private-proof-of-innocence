import { NetworkName, delay , TransactProofData } from '@railgun-community/shared-models';
import { Config } from '../config/config';
import { ListProviderPOIEventQueue } from './list-provider-poi-event-queue';
import { ShieldProofMempool } from '../proof-mempool/shield-proof-mempool';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';

// const dbg = debug('poi:event-updater');

export class ListProviderPOIEventUpdater {
  private static listKey: string;

  static init(listKey: string) {
    this.listKey = listKey;
  }

  static startPolling() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.poll();
  }

  private static async poll() {
    for (const networkName of Config.NETWORK_NAMES) {
      await this.addPOIEventsForShields(networkName);
      await this.addPOIEventsForTransacts(networkName);
    }

    // Run every 30 minutes
    await delay(30 * 60 * 1000);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.poll();
  }

  private static async addPOIEventsForShields(networkName: NetworkName) {
    const shieldQueueDB = new ShieldQueueDatabase(networkName);
    const allowedShieldsStream = await shieldQueueDB.streamAllowedShields();

    for await (const { hash } of allowedShieldsStream) {
      const shieldProofData =
        await ShieldProofMempool.getShieldProofDataForCommitmentHash(
          networkName,
          hash,
        );
      if (shieldProofData) {
        ListProviderPOIEventQueue.queueUnsignedPOIShieldEvent(
          networkName,
          shieldProofData,
        );
      }
    }
  }

  private static async addPOIEventsForTransacts(networkName: NetworkName) {
    const transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
      networkName,
    );
    const transactProofsStream =
      await transactProofMempoolDB.streamTransactProofs(
        ListProviderPOIEventUpdater.listKey,
      );
    for await (const transactProofDBItem of transactProofsStream) {
      const transactProofData: TransactProofData = {
        snarkProof: transactProofDBItem.snarkProof,
        poiMerkleroots: transactProofDBItem.poiMerkleroots,
        txidMerkleroot: transactProofDBItem.txidMerkleroot,
        txidMerklerootIndex: transactProofDBItem.txidMerklerootIndex,
        blindedCommitmentOutputs: transactProofDBItem.blindedCommitmentOutputs,
      };
      await TransactProofMempool.tryAddToActiveList(
        ListProviderPOIEventUpdater.listKey,
        networkName,
        transactProofData,
      );
    }
  }
}
