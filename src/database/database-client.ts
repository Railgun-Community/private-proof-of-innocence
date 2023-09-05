import { NetworkName, isDefined } from '@railgun-community/shared-models';
import { MongoClient } from 'mongodb';
import { Config } from '../config/config';
import { ShieldQueueDatabase } from './databases/shield-queue-database';

export class DatabaseClient {
  static client?: MongoClient;

  static async init() {
    if (DatabaseClient.client) {
      return DatabaseClient.client;
    }
    if (!isDefined(Config.MONGODB_URL)) {
      throw new Error('Set MONGODB_URL as mongodb:// string');
    }

    const client = await new MongoClient(Config.MONGODB_URL).connect();

    DatabaseClient.client = client;
    await DatabaseClient.ensureShieldIndicesAllChains();

    return client;
  }

  private static async ensureShieldIndicesAllChains(): Promise<void> {
    await Promise.all(
      Config.NETWORK_NAMES.map(async (networkName: NetworkName) => {
        const shieldQueueDb = new ShieldQueueDatabase(networkName);
        await shieldQueueDb.createIndex({ txid: 1, hash: 1 }, { unique: true });
      }),
    );
  }
}
