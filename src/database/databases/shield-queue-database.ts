import { NetworkName, isDefined } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  DBMax,
  DBSort,
  ShieldQueueDBItem,
  ShieldStatus,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { ShieldData } from '@railgun-community/wallet';

export class ShieldQueueDatabase extends AbstractDatabase<ShieldQueueDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.ShieldQueue);
  }

  async createCollectionIndices() {
    await this.createIndex(['txid', 'hash'], { unique: true });
    await this.createIndex(['timestamp']);
  }

  async insertPendingShield(shieldData: ShieldData): Promise<void> {
    if (!isDefined(shieldData.timestamp)) {
      return;
    }
    const storedData: ShieldQueueDBItem = {
      txid: shieldData.txid.toLowerCase(),
      hash: shieldData.hash.toLowerCase(),
      timestamp: shieldData.timestamp,
      status: ShieldStatus.Pending,
      lastValidatedTimestamp: undefined,
    };
    return this.insertOne(storedData);
  }

  async updateShieldStatus(
    shieldQueueDBItem: ShieldQueueDBItem,
    shouldAllow: boolean,
  ): Promise<void> {
    const filter: DBFilter<ShieldQueueDBItem> = {
      txid: shieldQueueDBItem.txid,
      hash: shieldQueueDBItem.hash,
    };
    const replacement: ShieldQueueDBItem = {
      ...shieldQueueDBItem,
      status: shouldAllow ? ShieldStatus.Allowed : ShieldStatus.Blocked,
      lastValidatedTimestamp: Date.now(),
    };
    return this.findOneAndReplace(filter, replacement);
  }

  async getPendingShields(endTimestamp: number): Promise<ShieldQueueDBItem[]> {
    const max: DBMax<ShieldQueueDBItem> = {
      timestamp: endTimestamp,
    };
    const filter: DBFilter<ShieldQueueDBItem> = {
      status: ShieldStatus.Pending,
    };
    const sort: DBSort<ShieldQueueDBItem> = {
      timestamp: 'ascending',
    };
    return this.findAll(max, filter, sort);
  }

  async getAllowedShields(): Promise<ShieldQueueDBItem[]> {
    const filter: DBFilter<ShieldQueueDBItem> = {
      status: ShieldStatus.Allowed,
    };
    return this.findAll(undefined, filter, undefined);
  }
}
