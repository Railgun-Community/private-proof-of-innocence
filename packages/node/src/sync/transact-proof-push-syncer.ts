import {
  NetworkName,
  delay,
  TransactProofData,
  TXIDVersion,
} from '@railgun-community/shared-models';
import { Config } from '../config/config';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';

export class TransactProofPushSyncer {
  private listKeys: string[];

  constructor(listKeys: string[]) {
    this.listKeys = listKeys;
  }

  startPolling() {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.poll();
  }

  private async poll() {
    for (const networkName of Config.NETWORK_NAMES) {
      for (const txidVersion of Config.TXID_VERSIONS) {
        await this.addPOIEventsForTransacts(networkName, txidVersion);
      }
    }

    // Run every 3 minutes
    await delay(3 * 60 * 1000);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.poll();
  }

  private async addPOIEventsForTransacts(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ) {
    const transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
      networkName,
      txidVersion,
    );

    for (const listKey of this.listKeys) {
      const transactProofsStream =
        await transactProofMempoolDB.streamTransactProofs(listKey);

      for await (const transactProofDBItem of transactProofsStream) {
        const transactProofData: TransactProofData = {
          snarkProof: transactProofDBItem.snarkProof,
          poiMerkleroots: transactProofDBItem.poiMerkleroots,
          txidMerkleroot: transactProofDBItem.txidMerkleroot,
          txidMerklerootIndex: transactProofDBItem.txidMerklerootIndex,
          blindedCommitmentsOut: transactProofDBItem.blindedCommitmentsOut,
          railgunTxidIfHasUnshield:
            transactProofDBItem.railgunTxidIfHasUnshield,
        };
        const success = await TransactProofMempool.tryAddToList(
          listKey,
          networkName,
          txidVersion,
          transactProofData,
        );
        if (success) {
          await TransactProofMempool.removeProof(
            listKey,
            networkName,
            txidVersion,
            transactProofData,
          );
        }
      }
    }
  }
}
