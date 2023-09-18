import { NetworkName } from '@railgun-community/shared-models';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { TransactProofMempoolCache } from './transact-proof-mempool-cache';

export class TransactProofMempoolPruner {
  static async removeProof(
    listKey: string,
    networkName: NetworkName,
    firstBlindedCommitment: string,
  ) {
    const db = new TransactProofPerListMempoolDatabase(networkName);
    await db.deleteProof(listKey, firstBlindedCommitment);

    TransactProofMempoolCache.removeFromCache(
      listKey,
      networkName,
      firstBlindedCommitment,
    );
  }
}
