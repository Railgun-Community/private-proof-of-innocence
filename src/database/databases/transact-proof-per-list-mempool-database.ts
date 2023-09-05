import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  TransactProofMempoolDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';

export class TransactProofPerListMempoolDatabase extends AbstractDatabase<TransactProofMempoolDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.TransactProofPerListMempool);
  }

  async createCollectionIndices() {
    // TODO
    await this.createIndex([], { unique: true });
  }

  async insertValidTransactProof(
    item: TransactProofMempoolDBItem,
  ): Promise<void> {
    return this.insertOne(item);
  }
}
