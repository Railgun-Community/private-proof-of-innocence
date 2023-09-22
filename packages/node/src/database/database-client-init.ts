import {
  NetworkName,
  isDefined,
  promiseTimeout,
} from '@railgun-community/shared-models';
import { MongoClient } from 'mongodb';
import { Config } from '../config/config';
import { ShieldQueueDatabase } from './databases/shield-queue-database';
import { StatusDatabase } from './databases/status-database';
import { CollectionName } from '../models/database-types';
import { AbstractDatabase } from './abstract-database';
import { TransactProofPerListMempoolDatabase } from './databases/transact-proof-per-list-mempool-database';
import { POIOrderedEventsDatabase } from './databases/poi-ordered-events-database';
import { POIMerkletreeDatabase } from './databases/poi-merkletree-database';
import { POIHistoricalMerklerootDatabase } from './databases/poi-historical-merkleroot-database';
import { TestDatabase } from './databases/test-database';
import { DatabaseClientStorage } from './database-client-storage';
import { RailgunTxidMerkletreeStatusDatabase } from './databases/railgun-txid-merkletree-status-database';
import { BlockedShieldsPerListDatabase } from './databases/blocked-shields-per-list-database';

export class DatabaseClient {
  static async init() {
    if (DatabaseClientStorage.client) {
      return DatabaseClientStorage.client;
    }

    await promiseTimeout(
      DatabaseClient.createClient(),
      2000,
      new Error('Could not connect to MongoDB'),
    );

    return DatabaseClientStorage.client;
  }

  private static async createClient() {
    if (!isDefined(Config.MONGODB_URL)) {
      throw new Error('Set MONGODB_URL as mongodb:// string');
    }
    const client = await new MongoClient(Config.MONGODB_URL).connect();
    DatabaseClientStorage.client = client;
  }

  static async ensureDBIndicesAllChains(): Promise<void> {
    await Promise.all(
      Config.NETWORK_NAMES.map(async (networkName: NetworkName) => {
        await Promise.all(
          Object.values(CollectionName).map(async collectionName => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let db: AbstractDatabase<any>;

            switch (collectionName) {
              case CollectionName.Status:
                db = new StatusDatabase(networkName);
                break;
              case CollectionName.ShieldQueue:
                db = new ShieldQueueDatabase(networkName);
                break;
              case CollectionName.TransactProofPerListMempool:
                db = new TransactProofPerListMempoolDatabase(networkName);
                break;
              case CollectionName.BlockedShieldsPerList:
                db = new BlockedShieldsPerListDatabase(networkName);
                break;
              case CollectionName.RailgunTxidMerkletreeStatus:
                db = new RailgunTxidMerkletreeStatusDatabase(networkName);
                break;
              case CollectionName.POIOrderedEvents:
                db = new POIOrderedEventsDatabase(networkName);
                break;
              case CollectionName.POIMerkletree:
                db = new POIMerkletreeDatabase(networkName);
                break;
              case CollectionName.POIHistoricalMerkleroots:
                db = new POIHistoricalMerklerootDatabase(networkName);
                break;
              case CollectionName.Test:
                db = new TestDatabase(networkName);
                break;
              default:
                throw new Error(
                  `Unsupported collection name: ${collectionName}`,
                );
            }

            await db.createCollectionIndices();
          }),
        );
      }),
    );
  }
}
