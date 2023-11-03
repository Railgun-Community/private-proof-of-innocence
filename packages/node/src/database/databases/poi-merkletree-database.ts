import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  POIMerkletreeDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';

export class POIMerkletreeDatabase extends AbstractDatabase<POIMerkletreeDBItem> {
  constructor(networkName: NetworkName, txidVersion: TXIDVersion) {
    super(networkName, txidVersion, CollectionName.POIMerkletree);
  }

  async createCollectionIndices() {
    await this.createIndex(['listKey', 'tree', 'level', 'index'], {
      unique: true,
    });
  }

  async updatePOIMerkletreeNodes(items: POIMerkletreeDBItem[]): Promise<void> {
    for (const item of items) {
      await this.insertMerkletreeNode(item)
    }
  }

  async deleteAllPOIMerkletreeNodesForTree(
    listKey: string,
    tree: number,
  ): Promise<void> {
    const filter: DBFilter<POIMerkletreeDBItem> = {
      listKey,
      tree,
    };
    await this.deleteMany(filter);
  }

  private async insertMerkletreeNode(item: POIMerkletreeDBItem): Promise<void> {
    const filter: DBFilter<POIMerkletreeDBItem> = {
      listKey: item.listKey,
      tree: item.tree,
      level: item.level,
      index: item.index,
    };
    if (item.level === 0) {
      // Only insert, never replace items at level 0.
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

  async getLeafNodeFromHash(
    listKey: string,
    nodeHash: string,
  ): Promise<Optional<POIMerkletreeDBItem>> {
    const filter: DBFilter<POIMerkletreeDBItem> = {
      listKey,
      level: 0,
      nodeHash,
    };
    const item = await this.findOne(filter);
    return item;
  }

  async nodeHashExists(listKey: string, nodeHash: string): Promise<boolean> {
    const filter: DBFilter<POIMerkletreeDBItem> = {
      listKey,
      level: 0,
      nodeHash,
    };
    return this.exists(filter);
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
