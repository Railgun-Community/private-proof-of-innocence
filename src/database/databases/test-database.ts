import { NetworkName } from '@railgun-community/shared-models';
import { AbstractDatabase } from '../abstract-database';
import { TestDBItem, CollectionName } from '../../models/database-types';
import { IndexDescription } from 'mongodb';

export class TestDatabase extends AbstractDatabase<TestDBItem> {
    constructor(networkName: NetworkName) {
        super(networkName, CollectionName.Test);
    }

    async createCollectionIndices() {
        await this.createIndex(['test'], { unique: true });
    }

    async getCollectionIndexes(): Promise<IndexDescription[]> {
        return this.listCollectionIndexes();
    }

    async insert(item: TestDBItem) { await this.insertOne(item); }

    async update(filter: Partial<TestDBItem>, item: Partial<TestDBItem>) { await this.updateOne(filter, item); }
}