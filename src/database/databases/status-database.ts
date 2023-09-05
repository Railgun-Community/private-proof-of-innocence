import { NetworkName } from '@railgun-community/shared-models';
import { CollectionName, StatusDBItem } from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { Filter } from 'mongodb';

export class StatusDatabase extends AbstractDatabase<StatusDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.Status);
  }

  async getStatus(): Promise<Optional<StatusDBItem>> {
    const filter: Filter<StatusDBItem> = {};
    return this.findOne(filter);
  }

  async saveStatus(latestBlockScanned: number): Promise<void> {
    const filter: Filter<StatusDBItem> = {};
    const replacement: StatusDBItem = {
      latestBlockScanned,
    };
    await this.findOneAndReplace(filter, replacement);
  }
}
