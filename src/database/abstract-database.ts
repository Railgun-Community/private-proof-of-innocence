import { NetworkName, isDefined } from '@railgun-community/shared-models';
import debug from 'debug';
import {
  Collection,
  Db,
  MongoError,
  OptionalUnlessRequiredId,
  Document,
  Filter,
  Sort,
  CreateIndexesOptions,
  WithId,
} from 'mongodb';
import { DatabaseClient } from './database-client';
import {
  CollectionName,
  DBFilter,
  DBIndexSpec,
  DBMaxMin,
} from '../models/database-types';
import { networkForName } from '../config/general';

export abstract class AbstractDatabase<T extends Document> {
  private db: Db;

  private collection: Collection<T>;

  private dbg: debug.Debugger;

  constructor(networkName: NetworkName, collection: CollectionName) {
    if (!DatabaseClient.client) {
      throw new Error('DatabaseClient not initialized');
    }

    const { chain } = networkForName(networkName);
    const chainKey = `${chain.type}:${chain.id}`;
    this.db = DatabaseClient.client.db(chainKey);

    this.collection = this.db.collection<T>(collection);
    this.dbg = debug(`poi:db:${collection}`);
  }

  async deleteAllItems_DANGEROUS() {
    await this.collection.deleteMany();
  }

  abstract createCollectionIndices(): Promise<void>;

  protected async insertOne(data: OptionalUnlessRequiredId<T>): Promise<void> {
    try {
      await this.collection.insertOne(data);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.onInsertError(err);
    }
  }

  protected async updateOne(filter: Filter<T>, item: Partial<T>) {
    try {
      await this.collection.updateOne(filter, item);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      this.dbg(err.message);
      throw err;
    }
  }

  protected async exists(filter: Filter<T>): Promise<boolean> {
    return (await this.findOne(filter)) != null;
  }

  protected async findOne(filter: Filter<T>): Promise<Optional<WithId<T>>> {
    const options = { projection: { _id: 0 } };
    const item = await this.collection.findOne(filter, options);
    return item ?? undefined;
  }

  protected async deleteOne(filter: Filter<T>): Promise<void> {
    await this.collection.deleteOne(filter);
  }

  protected async findOneAndReplace(
    filter: Filter<T>,
    replacement: T,
  ): Promise<void> {
    const options = { upsert: true };
    await this.collection.findOneAndReplace(filter, replacement, options);
  }

  protected async findAll(
    filter?: DBFilter<T>,
    sort?: Sort,
    max?: DBMaxMin<T>,
    min?: DBMaxMin<T>,
    limit?: number,
  ): Promise<T[]> {
    let cursor = this.collection.find();
    if (isDefined(max)) {
      cursor = cursor.max(max).hint(Object.keys(max));
    }
    if (isDefined(min)) {
      cursor = cursor.min(min).hint(Object.keys(min));
    }
    if (isDefined(filter)) {
      cursor = cursor.filter(filter);
    }
    if (isDefined(sort)) {
      cursor = cursor.sort(sort);
    }
    if (isDefined(limit)) {
      cursor = cursor.limit(limit);
    }
    return cursor.project({ _id: 0 }).toArray() as Promise<T[]>;
  }

  protected async count(filter?: Filter<T>) {
    return this.collection.countDocuments(filter);
  }

  protected async createIndex(
    indexSpec: DBIndexSpec<T>,
    options?: CreateIndexesOptions,
  ) {
    if (indexSpec.length === 0) {
      return;
    }
    return this.collection.createIndex(indexSpec as string[], options);
  }

  private onInsertError(err: MongoError) {
    if (err?.code === 11000) {
      this.dbg(err.message);
      // ignore duplicate key error
      return;
    }
    this.dbg(err.message);
    throw err;
  }
}
