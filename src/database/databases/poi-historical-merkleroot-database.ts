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

  async createCollectionIndices() {
    await this.createIndex(['rootHash'], { unique: true });
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
