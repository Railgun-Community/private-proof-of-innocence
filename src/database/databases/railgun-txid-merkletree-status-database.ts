import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  RailgunTxidMerkletreeStatusDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { IndexDescription } from 'mongodb';

export class RailgunTxidMerkletreeStatusDatabase extends AbstractDatabase<RailgunTxidMerkletreeStatusDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.RailgunTxidMerkletreeStatus);
  }

  async createCollectionIndices() {
    // No index
    await this.createIndex([], {});
  }

  async getCollectionIndexes(): Promise<IndexDescription[]> {
    return this.listCollectionIndexes();
  }

  async getStatus(): Promise<Optional<RailgunTxidMerkletreeStatusDBItem>> {
    const filter: DBFilter<RailgunTxidMerkletreeStatusDBItem> = {};
    return this.findOne(filter);
  }

  async saveValidatedTxidStatus(
    validatedTxidIndex: number,
    validatedTxidMerkleroot: string,
  ): Promise<void> {
    const filter: DBFilter<RailgunTxidMerkletreeStatusDBItem> = {};
    const replacement: RailgunTxidMerkletreeStatusDBItem = {
      validatedTxidIndex,
      validatedTxidMerkleroot,
    };
    await this.upsertOne(filter, replacement);
  }
}
