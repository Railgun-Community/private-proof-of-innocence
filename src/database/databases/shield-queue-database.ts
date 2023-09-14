import { NetworkName, isDefined } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  DBMaxMin,
  DBSort,
  DBStream,
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
    await this.createIndex(['txid']);
    await this.createIndex(['hash'], { unique: true });
    await this.createIndex(['timestamp']);
    await this.createIndex(['status']);
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
      blockNumber: shieldData.blockNumber,
    };
    return this.insertOne(storedData);
  }

  async commitmentHashExists(
    hash: string,
    status?: ShieldStatus,
  ): Promise<boolean> {
    const filter: DBFilter<ShieldQueueDBItem> = {
      hash,
      status,
    };
    return this.exists(filter);
  }

  async updateShieldStatus(
    shieldQueueDBItem: ShieldQueueDBItem,
    status: ShieldStatus,
  ): Promise<void> {
    const filter: DBFilter<ShieldQueueDBItem> = {
      txid: shieldQueueDBItem.txid,
      hash: shieldQueueDBItem.hash,
    };
    const replacement: ShieldQueueDBItem = {
      ...shieldQueueDBItem,
      status,
      lastValidatedTimestamp: Date.now(),
    };
    return this.upsertOne(filter, replacement);
  }

  async getPendingShields(
    endTimestamp: number,
    limit?: number,
  ): Promise<ShieldQueueDBItem[]> {
    const filter: DBFilter<ShieldQueueDBItem> = {
      status: ShieldStatus.Pending,
    };
    const sort: DBSort<ShieldQueueDBItem> = {
      timestamp: 'ascending',
    };
    const max: DBMaxMin<ShieldQueueDBItem> = {
      timestamp: endTimestamp,
    };
    return this.findAll(filter, sort, max, undefined, limit);
  }

  async getAllowedShieldByHash(
    hash: string,
  ): Promise<Optional<ShieldQueueDBItem>> {
    const filter: DBFilter<ShieldQueueDBItem> = {
      status: ShieldStatus.Allowed,
      hash,
    };
    return this.findOne(filter);
  }

  async getShieldStatus(hash: string): Promise<Optional<ShieldStatus>> {
    return (await this.findOne({ hash }))?.status;
  }

  async getAllowedShields(): Promise<ShieldQueueDBItem[]> {
    const filter: DBFilter<ShieldQueueDBItem> = {
      status: ShieldStatus.Allowed,
    };
    return this.findAll(filter);
  }

  async streamAllowedShields(): Promise<DBStream<ShieldQueueDBItem>> {
    const filter: DBFilter<ShieldQueueDBItem> = {
      status: ShieldStatus.Allowed,
    };
    return this.stream(filter);
  }

  async getLatestPendingShield(): Promise<Optional<ShieldQueueDBItem>> {
    const filter: DBFilter<ShieldQueueDBItem> = {
      status: ShieldStatus.Pending,
    };
    const sort: DBSort<ShieldQueueDBItem> = {
      timestamp: 'descending',
    };
    return this.findOne(filter, sort);
  }

  async getCount(status?: ShieldStatus): Promise<number> {
    const filter: DBFilter<ShieldQueueDBItem> = {
      status,
    };
    return this.count(filter);
  }
}
