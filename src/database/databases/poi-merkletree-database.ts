import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  POIMerkletreeDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';

export class POIMerkletreeDatabase extends AbstractDatabase<POIMerkletreeDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.POIMerkletree);
  }

  async createCollectionIndices() {
    await this.createIndex(['tree', 'level', 'index', 'listKey'], {
      unique: true,
    });
  }
}
