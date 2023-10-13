import {
  LegacyTransactProofData,
  NetworkName,
  TXIDVersion,
} from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  DBStream,
  LegacyTransactProofMempoolDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';

export class LegacyTransactProofMempoolDatabase extends AbstractDatabase<LegacyTransactProofMempoolDBItem> {
  constructor(networkName: NetworkName, txidVersion: TXIDVersion) {
    super(networkName, txidVersion, CollectionName.LegacyTransactProofMempool);
  }

  async createCollectionIndices() {
    await this.createIndex(['blindedCommitment'], {
      unique: true,
    });
  }

  async insertLegacyTransactProof(
    legacyTransactProofData: LegacyTransactProofData,
  ): Promise<void> {
    const item: LegacyTransactProofMempoolDBItem = {
      txidIndex: legacyTransactProofData.txidIndex,
      npk: legacyTransactProofData.npk,
      value: legacyTransactProofData.value,
      tokenHash: legacyTransactProofData.tokenHash,
      blindedCommitment: legacyTransactProofData.blindedCommitment,
    };
    return this.insertOne(item);
  }

  async legacyProofExists(blindedCommitment: string): Promise<boolean> {
    const filter: DBFilter<LegacyTransactProofMempoolDBItem> = {
      blindedCommitment,
    };
    return this.exists(filter);
  }

  async streamLegacyTransactProofs(): Promise<
    DBStream<LegacyTransactProofMempoolDBItem>
  > {
    const filter: DBFilter<LegacyTransactProofMempoolDBItem> = {};
    return this.stream(filter);
  }
}
