import { Collection, Db, MongoClient, MongoError } from 'mongodb';
import { Config } from '../config/config';
import {
  NETWORK_CONFIG,
  NetworkName,
  isDefined,
} from '@railgun-community/shared-models';
import debug from 'debug';
import { ShieldDBEntry, StatusDBEntry } from './db-types';
import { networkForName } from '../config/general';

enum CollectionName {
  Status = 'status',
  Shields = 'shields',
}

const dbg = debug('poi:db');

const config: { client?: MongoClient } = {
  client: undefined,
};

const shieldsCollectionFromDb = (db: Db): Collection<ShieldDBEntry> => {
  return db.collection<ShieldDBEntry>(CollectionName.Shields);
};

export const shieldsCollection = async (
  networkName: NetworkName,
): Promise<Collection<ShieldDBEntry>> => {
  const db = await getDB(networkName);
  return shieldsCollectionFromDb(db);
};

export const statusCollection = async (
  networkName: NetworkName,
): Promise<Collection<StatusDBEntry>> => {
  const db = await getDB(networkName);
  return db.collection<StatusDBEntry>(CollectionName.Status);
};

const chainStr = (networkName: NetworkName): string => {
  const { chain } = networkForName(networkName);
  return `${chain.type}:${chain.id}`;
};

const chainDBKey = (networkName: NetworkName) => {
  return `db-${chainStr(networkName)}`;
};

const getDB = async (networkName: NetworkName) => {
  return (await getClient()).db(chainDBKey(networkName));
};

export const onInsertError = (err: MongoError) => {
  if (err?.code === 11000) {
    dbg(err.message);
    // ignore duplicate key error
    return;
  }
  dbg(err.message);
  throw err;
};

const ensureIndicesAllChains = async (client: MongoClient): Promise<void> => {
  await Promise.all(
    Config.NETWORK_NAMES.map(async (networkName: NetworkName) => {
      const db = client.db(chainDBKey(networkName));
      const shieldsCollection = shieldsCollectionFromDb(db);
      await shieldsCollection.createIndex(
        { txid: 1, hash: 1 },
        { unique: true },
      );
    }),
  );
};

const getClient = async () => {
  if (config.client) {
    return config.client;
  }
  if (!isDefined(Config.MONGODB_URL)) {
    throw new Error('Set MONGODB_URL as mongodb:// string');
  }

  config.client = await new MongoClient(Config.MONGODB_URL).connect();
  await ensureIndicesAllChains(config.client);

  return config.client;
};
