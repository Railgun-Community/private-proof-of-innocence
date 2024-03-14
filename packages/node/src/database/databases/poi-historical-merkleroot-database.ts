import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  POIHistoricalMerklerootDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';

export class POIHistoricalMerklerootDatabase extends AbstractDatabase<POIHistoricalMerklerootDBItem> {
  constructor(networkName: NetworkName, txidVersion: TXIDVersion) {
    super(networkName, txidVersion, CollectionName.POIHistoricalMerkleroots);
  }

  async createCollectionIndices() {
    await this.createIndex(['rootHash', 'listKey', 'index'], { unique: true });
  }

  async insertMerkleroot(
    listKey: string,
    index: number,
    rootHash: string,
  ): Promise<void> {
    const item: POIHistoricalMerklerootDBItem = {
      listKey,
      rootHash,
      index,
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
  ): Promise<Optional<POIHistoricalMerklerootDBItem>> {
    // Sort by _id in descending order to get the latest document
    const latestRoot = await this.findOne({ listKey }, { _id: -1 });
    return latestRoot;
  }

  async getMerklerootByGlobalLeafIndex(
    listKey: string,
    index: number,
  ): Promise<Optional<POIHistoricalMerklerootDBItem>> {
    const rootDbItem = await this.findOne({ listKey, index });
    return rootDbItem;
  }

  async deleteAllPOIMerklerootsForList_DANGEROUS(listKey: string) {
    const filter: DBFilter<POIHistoricalMerklerootDBItem> = {
      listKey,
    };
    await this.deleteMany(filter);
  }
}
