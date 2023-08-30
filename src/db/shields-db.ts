import { NetworkName, isDefined } from '@railgun-community/shared-models';
import { ShieldData } from '@railgun-community/wallet';
import { SortDirection, InsertOneResult, UpdateResult } from 'mongodb';
import { onInsertError, shieldsCollection } from './db';
import { ShieldStatus, ShieldDBEntry } from './db-types';

export const getPendingShields = async (
  networkName: NetworkName,
  endTimestamp: number,
): Promise<ShieldDBEntry[]> => {
  const sort: Record<string, SortDirection> = {
    timestamp: 1,
  };
  const collection = await shieldsCollection(networkName);
  return collection
    .find()
    .max({ timestamp: endTimestamp })
    .filter({ status: ShieldStatus.Pending })
    .sort(sort)
    .project({ _id: 0 })
    .toArray() as Promise<ShieldDBEntry[]>;
};

export const insertPendingShield = async (
  networkName: NetworkName,
  shieldData: ShieldData,
): Promise<InsertOneResult<ShieldDBEntry> | void> => {
  if (!isDefined(shieldData.timestamp)) {
    return;
  }
  const db = await shieldsCollection(networkName);
  const storedData: ShieldDBEntry = {
    txid: shieldData.txid.toLowerCase(),
    hash: shieldData.hash.toLowerCase(),
    timestamp: shieldData.timestamp,
    status: ShieldStatus.Pending,
    lastValidatedTimestamp: undefined,
  };
  return db.insertOne(storedData).catch(onInsertError);
};

export const updateShieldStatus = async (
  networkName: NetworkName,
  shieldData: ShieldDBEntry,
  shouldAllow: boolean,
): Promise<UpdateResult<ShieldDBEntry> | void> => {
  const db = await shieldsCollection(networkName);
  const storedData: Partial<ShieldDBEntry> = {
    status: shouldAllow ? ShieldStatus.Allowed : ShieldStatus.Blocked,
    lastValidatedTimestamp: Date.now(),
  };
  const filter = { txid: shieldData.txid, hash: shieldData.hash };
  return db.updateOne(filter, storedData);
};
