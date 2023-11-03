import {
  NetworkName,
  TXIDVersion,
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
import { LegacyTransactProofMempoolDatabase } from './databases/legacy-transact-proof-mempool-database';

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
    for (const networkName of Config.NETWORK_NAMES) {
      for (const txidVersion of Config.TXID_VERSIONS) {
        await this.createAllCollectionsWithIndices(
          networkName,
          txidVersion,
        );
      }
    }
  }

  static async createAllCollectionsWithIndices(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Promise<void> {
    for (const collectionName of Object.values(CollectionName)) {
        let db: AbstractDatabase<any>;

        switch (collectionName) {
          case CollectionName.Status:
            db = new StatusDatabase(networkName, txidVersion);
            break;
          case CollectionName.ShieldQueue:
            db = new ShieldQueueDatabase(networkName, txidVersion);
            break;
          case CollectionName.TransactProofPerListMempool:
            db = new TransactProofPerListMempoolDatabase(
              networkName,
              txidVersion,
            );
            break;
          case CollectionName.LegacyTransactProofMempool:
            db = new LegacyTransactProofMempoolDatabase(
              networkName,
              txidVersion,
            );
            break;
          case CollectionName.BlockedShieldsPerList:
            db = new BlockedShieldsPerListDatabase(networkName, txidVersion);
            break;
          case CollectionName.RailgunTxidMerkletreeStatus:
            db = new RailgunTxidMerkletreeStatusDatabase(
              networkName,
              txidVersion,
            );
            break;
          case CollectionName.POIOrderedEvents:
            db = new POIOrderedEventsDatabase(networkName, txidVersion);
            break;
          case CollectionName.POIMerkletree:
            db = new POIMerkletreeDatabase(networkName, txidVersion);
            break;
          case CollectionName.POIHistoricalMerkleroots:
            db = new POIHistoricalMerklerootDatabase(networkName, txidVersion);
            break;
          case CollectionName.Test:
            db = new TestDatabase(networkName, txidVersion);
            break;
          default:
            throw new Error(`Unsupported collection name: ${collectionName}`);
        }

        await db.createCollectionIndices();
    }
  }
}
