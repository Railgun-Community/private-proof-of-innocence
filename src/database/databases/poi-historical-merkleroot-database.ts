import { NetworkName, isDefined } from '@railgun-community/shared-models';
import {
  CollectionName,
  POIHistoricalMerklerootDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';

export class POIHistoricalMerklerootDatabase extends AbstractDatabase<POIHistoricalMerklerootDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.POIHistoricalMerkleroots);
  }

  async createCollectionIndex() {
    await this.createIndex({ rootHash: 1 }, { unique: true });
  }

  async insertMerkleroot(rootHash: string): Promise<void> {
    const item: POIHistoricalMerklerootDBItem = {
      rootHash,
    };
    await this.insertOne(item);
  }

  async containsMerkleroot(rootHash: string): Promise<boolean> {
    const item = await this.findOne({ rootHash });
    return isDefined(item);
  }
}
