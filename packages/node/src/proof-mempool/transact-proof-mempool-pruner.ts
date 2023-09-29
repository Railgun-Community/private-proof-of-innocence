import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { TransactProofMempoolCache } from './transact-proof-mempool-cache';

export class TransactProofMempoolPruner {
  static async removeProof(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    firstBlindedCommitment: string,
  ) {
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
  }
}
