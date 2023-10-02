import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { TransactProofMempoolCache } from './transact-proof-mempool-cache';
import debug from 'debug';

const dbg = debug('poi:transact-proof-mempool');

export class TransactProofMempoolPruner {
  static async removeProof(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    firstBlindedCommitment: string,
  ) {
    try {
      const db = new TransactProofPerListMempoolDatabase(
        networkName,
        txidVersion,
      );
      await db.deleteProof(listKey, firstBlindedCommitment);

      TransactProofMempoolCache.removeFromCache(
        listKey,
        networkName,
        txidVersion,
        firstBlindedCommitment,
      );
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(`Error removing from transact proof mempool: ${err.message}`);
      return;
    }
  }
}
