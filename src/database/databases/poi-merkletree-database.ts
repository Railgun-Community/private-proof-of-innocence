import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  POIMerkletreeDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { IndexDescription } from 'mongodb';

export class POIMerkletreeDatabase extends AbstractDatabase<POIMerkletreeDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.POIMerkletree);
  }

  async createCollectionIndices() {
    await this.createIndex(['listKey', 'tree', 'level', 'index'], {
      unique: true,
    });
  }

  async getCollectionIndexes(): Promise<IndexDescription[]> {
    return this.listCollectionIndexes();
  }

  async updatePOIMerkletreeNodes(items: POIMerkletreeDBItem[]): Promise<void> {
    await Promise.all(items.map(this.insertMerkletreeNode));
  }

  private async insertMerkletreeNode(item: POIMerkletreeDBItem) {
    const filter: DBFilter<POIMerkletreeDBItem> = {
      listKey: item.listKey,
      tree: item.tree,
      level: item.level,
      index: item.index,
    };
    if (item.level === 0) {
      // Never replace items at level 0.
      return this.insertOne(item);
    }
    return this.upsertOne(filter, item);
  }

  async getPOINodeHash(
    listKey: string,
    tree: number,
    level: number,
    index: number,
  ): Promise<Optional<string>> {
    const filter: DBFilter<POIMerkletreeDBItem> = {
      listKey,
      tree,
      level,
      index,
    };
    const item = await this.findOne(filter);
    return item?.nodeHash;
  }

  async countLeavesInTree(listKey: string, tree: number): Promise<number> {
    const filter: DBFilter<POIMerkletreeDBItem> = {
      listKey,
      tree,
      level: 0,
    };
    return this.count(filter);
  }
}
