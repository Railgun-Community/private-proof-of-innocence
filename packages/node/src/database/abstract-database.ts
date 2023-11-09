import {
  NetworkName,
  TXIDVersion,
  isDefined,
} from '@railgun-community/shared-models';
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
  IndexDescription,
  FindOptions,
} from 'mongodb';
import { DatabaseClientStorage } from './database-client-storage';
import {
  CollectionName,
  DBFilter,
  DBIndexSpec,
  DBStream,
} from '../models/database-types';
import { networkForName } from '../config/general';

export abstract class AbstractDatabase<T extends Document> {
  private db: Db;

  private collection: Collection<T>;

  private dbg: debug.Debugger;

  constructor(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    collection: CollectionName,
  ) {
    if (!DatabaseClientStorage.client) {
      throw new Error('DatabaseClient not initialized');
    }

    const { chain } = networkForName(networkName);
    const dbKey = `${chain.type}:${chain.id}:${txidVersion}`;
    this.db = DatabaseClientStorage.client.db(dbKey);

    this.collection = this.db.collection<T>(collection);
    this.dbg = debug(`poi:db:${collection}`);
  }

  async deleteAllItems_DANGEROUS() {
    await this.collection.deleteMany();
  }

  abstract createCollectionIndices(): Promise<void>;

  public async listCollectionIndexes(): Promise<IndexDescription[]> {
    return this.collection.listIndexes().toArray();
  }

  protected async insertOne(data: OptionalUnlessRequiredId<T>): Promise<void> {
    try {
      await this.collection.insertOne(data);
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      this.onInsertError(err); // this method suppresses duplicate key errors, code 11000
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

  protected async findOne(
    filter: Filter<T>,
    sort?: Sort,
  ): Promise<Optional<WithId<T>>> {
    const options: FindOptions<T> = { projection: { _id: 0 }, sort };
    const item = await this.collection.findOne(filter, options);
    return item ?? undefined;
  }

  protected async deleteOne(filter: Filter<T>): Promise<void> {
    await this.collection.deleteOne(filter);
  }

  protected async deleteMany(filter: Filter<T>): Promise<void> {
    await this.collection.deleteMany(filter);
  }

  protected async upsertOne(filter: Filter<T>, item: T): Promise<void> {
    const options = { upsert: true };
    await this.collection.findOneAndReplace(filter, item, options);
  }

  protected async findAll(
    filter?: Filter<T>,
    sort?: Sort,
    limit?: number,
  ): Promise<T[]> {
    let cursor = this.collection.find();
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

  protected async stream(
    filter?: DBFilter<T>,
    sort?: Sort,
  ): Promise<DBStream<T>> {
    let cursor = this.collection.find();
    if (isDefined(filter)) {
      cursor = cursor.filter(filter);
    }
    if (isDefined(sort)) {
      cursor = cursor.sort(sort);
    }
    return cursor.project({ _id: 0 }).stream();
  }

  protected async count(filter?: Filter<T>) {
    return this.collection.countDocuments(filter);
  }

  private getIndexName(indexSpec: DBIndexSpec<T>) {
    return indexSpec
      .map((indexKey: keyof T) => `${indexKey as string}_1`)
      .join('_');
  }

  protected async createIndex(
    indexSpec: DBIndexSpec<T>,
    options?: CreateIndexesOptions,
  ) {
    if (indexSpec.length === 0) {
      return;
    }

    // Check that the combined length of the collection name and index name is less than 63 characters
    const collectionName = this.collection.collectionName;
    const indexName = options?.name ?? this.getIndexName(indexSpec);
    const combinedLength = collectionName.length + indexName.length;
    if (combinedLength > 63) {
      throw new Error(
        `Index name ${indexName} is too long for collection ${collectionName}`,
      );
    }

    try {
      const createdIndexName = await this.collection.createIndex(
        indexSpec as string[],
        options,
      );
      if (createdIndexName !== indexName) {
        this.dbg(
          `Unexpected indexName: got ${createdIndexName}, expected ${indexName}`,
        );
        console.log(
          `Unexpected indexName: got ${createdIndexName}, expected ${indexName}`,
        );
      }
    } catch (err) {
      this.dbg(
        `Error while creating index with spec: ${JSON.stringify(
          indexSpec,
        )} and options: ${JSON.stringify(options)}`,
      );
      this.dbg(err.message);
      throw err;
    }
  }

  async indexExists(indexes: string[], unique: boolean): Promise<boolean> {
    const existingIndexes = await this.listCollectionIndexes();
    return isDefined(
      existingIndexes.find(index => {
        if (unique !== (index.unique ?? false)) {
          return false;
        }
        if (Object.keys(index.key).length !== indexes.length) {
          return false;
        }
        return indexes.every(indexName => {
          return 'key' in index && indexName in index.key;
        });
      }),
    );
  }

  async dropIndex(indexSpec: DBIndexSpec<T>) {
    try {
      const indexName = this.getIndexName(indexSpec);
      return await this.collection.dropIndex(indexName);
    } catch (err) {
      this.dbg(
        `Error while dropping index with spec: ${JSON.stringify(indexSpec)}`,
      );
      this.dbg(err.message);
      throw err;
    }
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
