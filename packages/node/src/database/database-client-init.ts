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
import { CollectionName, TestDBItem } from '../models/database-types';
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

    // Ensure connection attempt does not take longer than 2 seconds
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

    // Perform a health check using the TestDatabase
    const testDb = new TestDatabase(
      NetworkName.Ethereum,
      TXIDVersion.V2_PoseidonMerkle,
    );
    const healthCheckDoc: TestDBItem = {
      test: 'healthcheck',
      test2: 'healthcheck',
    };

    try {
      // Insert a document, read it back, and delete it
      await testDb.insert(healthCheckDoc);
      const insertedDoc = await testDb.getItem({ test: 'healthcheck' });
      if (!insertedDoc || insertedDoc.test2 !== healthCheckDoc.test2) {
        throw new Error('Health check failed: Read/Write inconsistency.');
      }
      await testDb.delete({ test: 'healthcheck' });
    } catch (error) {
      await client.close();
      throw error;
    }
  }

  static async ensureDBIndicesAllChains(): Promise<void> {
    await Promise.all(
      Config.NETWORK_NAMES.map(async (networkName: NetworkName) => {
        await Promise.all(
          Config.TXID_VERSIONS.map(async (txidVersion: TXIDVersion) => {
            await this.createAllCollectionsWithIndices(
              networkName,
              txidVersion,
            );
          }),
        );
      }),
    );
  }

  static async createAllCollectionsWithIndices(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Promise<void> {
    await Promise.all(
      Object.values(CollectionName).map(async collectionName => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      }),
    );
  }
}
