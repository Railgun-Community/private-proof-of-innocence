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
    await this.createIndex(['rootHash', 'listKey'], { unique: true });
  }

  async insertMerkleroot(listKey: string, rootHash: string): Promise<void> {
    const item: POIHistoricalMerklerootDBItem = {
      listKey,
      rootHash,
    };
    await this.insertOne(item);
  }

  async containsMerkleroot(
    listKey: string,
    rootHash: string,
  ): Promise<boolean> {
    const item = await this.findOne({ listKey, rootHash });
    return isDefined(item);
  }
}
