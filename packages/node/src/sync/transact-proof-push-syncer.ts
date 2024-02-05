/**
 * TransactProofPushSyncer is for periodically checking if transact proofs are stuck in the mempool.
 * If the proof does not exist in the list yet, they are added to the list.
 * If the proof exists in the list and in the mempool, they are removed from the mempool.
 */
import {
  NetworkName,
  delay,
  TransactProofData,
  TXIDVersion,
} from '@railgun-community/shared-models';
import { Config } from '../config/config';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { TransactProofEventMatcher } from '../proof-mempool/transact-proof-event-matcher';
import { TransactProofMempoolPruner } from '../proof-mempool/transact-proof-mempool-pruner';
import { TransactProofMempool } from '../proof-mempool/transact-proof-mempool';
import debug from 'debug';

const dbg = debug('poi:transact-proof-push-syncer');
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

  /**
   * Add POI events for transacts that are in the mempool.
   *
   * @param networkName - network name to add POI events for
   * @param txidVersion - txid version to add POI events for
   * @returns void
   *
   * @remarks This trys to add transact proofs to the list every 3 minutes.
   * @remarks Proofs are checked to see if they are stuck in the mempool.
   */
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

        // Remove proof if stuck in mempool when already exists in list.
        const orderedEventsExist =
          await TransactProofEventMatcher.hasOrderedEventForEveryBlindedCommitment(
            listKey,
            networkName,
            txidVersion,
            transactProofData.blindedCommitmentsOut,
            transactProofData.railgunTxidIfHasUnshield,
          );

        if (orderedEventsExist) {
          dbg('Event already exists for every blinded commitment');

          // Remove item from database.
          await TransactProofMempoolPruner.removeProof(
            listKey,
            networkName,
            txidVersion,
            transactProofData.blindedCommitmentsOut,
            transactProofData.railgunTxidIfHasUnshield,
            true, // shouldSendNodeRequest to remove from other nodes
          );
          return;
        }

        // Try adding proof to list.
        await TransactProofMempool.tryAddToList(
          listKey,
          networkName,
          txidVersion,
          transactProofData,
        );
      }
    }
  }
}
