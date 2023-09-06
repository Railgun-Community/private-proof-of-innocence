import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  POIMerkletreeDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { IndexDescription } from 'mongodb';

export class POIMerkletreeDatabase extends AbstractDatabase<POIMerkletreeDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.POIMerkletree);
  }

  async createCollectionIndices() {
    await this.createIndex(['tree', 'level', 'index', 'listKey'], {
      unique: true,
    });
  }

  async getCollectionIndexes(): Promise<IndexDescription[]> {
    return this.listCollectionIndexes();
  }
}
