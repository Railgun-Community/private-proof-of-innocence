import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  POIMerkletreeDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';

export class POIHistoricalMerklerootDatabase extends AbstractDatabase<POIMerkletreeDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.POIHistoricalMerkleroots);
  }

  async createCollectionIndex() {
    await this.createIndex({ tree: 1, level: 1, index: 1 }, { unique: true });
  }
}
