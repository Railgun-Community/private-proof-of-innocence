import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import {
  CollectionName,
  POIHistoricalMerklerootDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { Filter } from 'mongodb';

export class POIHistoricalMerklerootDatabase extends AbstractDatabase<POIHistoricalMerklerootDBItem> {
  constructor(networkName: NetworkName, txidVersion: TXIDVersion) {
    super(networkName, txidVersion, CollectionName.POIHistoricalMerkleroots);
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

  async merklerootExists(listKey: string, rootHash: string): Promise<boolean> {
    return this.exists({ listKey, rootHash });
  }

  async allMerklerootsExist(
    listKey: string,
    rootHashes: string[],
  ): Promise<boolean> {
    for (const rootHash of rootHashes) {
      if (!(await this.merklerootExists(listKey, rootHash))) {
        return false;
      }
    }
    return true;
  }

  async getTotalMerkleroots(listKey: string): Promise<number> {
    return this.count({ listKey });
  }

  async getLatestMerkleroot(
    listKey: string,
  ): Promise<POIHistoricalMerklerootDBItem | undefined> {
    // Sort by _id in descending order to get the latest document
    const latestRoot = await this.findOne({ listKey }, { _id: -1 });
    return latestRoot;
  }
}
