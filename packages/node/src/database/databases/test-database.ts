import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { AbstractDatabase } from '../abstract-database';
import { TestDBItem, CollectionName } from '../../models/database-types';
import { WithId } from 'mongodb';

export class TestDatabase extends AbstractDatabase<TestDBItem> {
  constructor(networkName: NetworkName, txidVersion: TXIDVersion) {
    super(networkName, txidVersion, CollectionName.Test);
  }

  async createCollectionIndices() {
    await this.createIndex(['test'], { unique: true });
    await this.createIndex(['test', 'test2']);
  }

  async createLongIndexForTest() {
    await this.createIndex([
      'veryBigAndLongIndexNameToForceFailurePart1',
      'veryBigAndLongIndexNameToForceFailurePart2',
    ]);
  }

  async createCustomNameIndexForTest() {
    await this.createIndex(['test2'], { name: 'customIndexName' });
  }

  async getItem(
    filter: Partial<TestDBItem>,
  ): Promise<WithId<TestDBItem> | null | undefined> {
    return this.findOne(filter);
  }

  async insert(item: TestDBItem) {
    await this.insertOne(item);
  }

  async update(filter: Partial<TestDBItem>, item: Partial<TestDBItem>) {
    await this.updateOne(filter, item);
  }

  async delete(filter: Partial<TestDBItem>): Promise<void> {
    await this.deleteOne(filter);
  }
}
