import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  StatusDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';

export class StatusDatabase extends AbstractDatabase<StatusDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.Status);
  }

  async createCollectionIndex() {
    // No index
    await this.createIndex({}, {});
  }

  async getStatus(): Promise<Optional<StatusDBItem>> {
    const filter: DBFilter<StatusDBItem> = {};
    return this.findOne(filter);
  }

  async saveStatus(latestBlockScanned: number): Promise<void> {
    const filter: DBFilter<StatusDBItem> = {};
    const replacement: StatusDBItem = {
      latestBlockScanned,
    };
    await this.findOneAndReplace(filter, replacement);
  }
}
