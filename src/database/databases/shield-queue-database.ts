import { NetworkName, isDefined } from '@railgun-community/shared-models';
import {
  CollectionName,
  ShieldQueueDBItem,
  ShieldStatus,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { ShieldData } from '@railgun-community/wallet';
import { Filter, Sort } from 'mongodb';

export class ShieldQueueDatabase extends AbstractDatabase<ShieldQueueDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.ShieldQueue);
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
    shieldData: ShieldQueueDBItem,
    shouldAllow: boolean,
  ): Promise<void> {
    const filter: Filter<ShieldQueueDBItem> = {
      txid: shieldData.txid,
      hash: shieldData.hash,
    };
    const storedData: Partial<ShieldQueueDBItem> = {
      status: shouldAllow ? ShieldStatus.Allowed : ShieldStatus.Blocked,
      lastValidatedTimestamp: Date.now(),
    };
    return this.updateOne(filter, storedData);
  }

  async getPendingShields(endTimestamp: number): Promise<ShieldQueueDBItem[]> {
    const max: Partial<ShieldQueueDBItem> = {
      timestamp: endTimestamp,
    };
    const filter = {
      status: ShieldStatus.Pending,
    };
    const sort: Sort = {
      timestamp: 'ascending',
    };
    return this.findAll(max, filter, sort);
  }
}
