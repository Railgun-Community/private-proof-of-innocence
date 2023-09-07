import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  POIHistoricalMerklerootDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { Filter, IndexDescription } from 'mongodb';

export class POIHistoricalMerklerootDatabase extends AbstractDatabase<POIHistoricalMerklerootDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.POIHistoricalMerkleroots);
  }

  async createCollectionIndices() {
    await this.createIndex(['rootHash', 'listKey'], { unique: true });
  }

  async getCollectionIndexes(): Promise<IndexDescription[]> {
    return this.listCollectionIndexes();
  }

  async insertMerkleroot(listKey: string, rootHash: string): Promise<void> {
    const item: POIHistoricalMerklerootDBItem = {
      listKey,
      rootHash,
    };
    await this.insertOne(item);
  }

  async merklerootExists(listKey: string, rootHash: string): Promise<boolean> {
    return this.exists({ listKey, rootHash });
  }

  async allMerklerootsExist(
    listKey: string,
    rootHashes: string[],
  ): Promise<boolean> {
    const filter: Filter<POIHistoricalMerklerootDBItem> = {
      listKey,
      rootHash: { $in: rootHashes },
    };
    const count = await this.count(filter);
    return count === rootHashes.length;
  }
}
