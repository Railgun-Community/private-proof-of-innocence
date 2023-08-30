import { NetworkName } from '@railgun-community/shared-models';
import { statusCollection } from './db';
import { StatusDBEntry } from './db-types';
import debug from 'debug';

const dbg = debug('poi:db:status');

export const getStatus = async (
  networkName: NetworkName,
): Promise<Optional<StatusDBEntry>> => {
  const db = await statusCollection(networkName);
  const doc = await db.findOne({}, { projection: { _id: 0 } });
  return doc ?? undefined;
};

export const saveStatus = async (
  networkName: NetworkName,
  latestBlockScanned: number,
): Promise<void> => {
  try {
    const db = await statusCollection(networkName);
    await db.findOneAndReplace({}, { latestBlockScanned }, { upsert: true });
  } catch (err) {
    dbg(err);
  }
};
