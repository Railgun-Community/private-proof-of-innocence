import { NetworkName } from '@railgun-community/shared-models';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { ShieldStatus } from '../models/database-types';

export const MAX_EVENT_QUERY_RANGE_LENGTH = 20;

type ShieldQueueStatus = {
  pending: number;
  allowed: number;
  blocked: number;
  addedPoi: number;
};

export const getShieldQueueStatus = async (
  networkName: NetworkName,
): Promise<ShieldQueueStatus> => {
  const db = new ShieldQueueDatabase(networkName);

  const pending = await db.getCount(ShieldStatus.Pending);
  const allowed = await db.getCount(ShieldStatus.Allowed);
  const blocked = await db.getCount(ShieldStatus.Blocked);
  const addedPoi = await db.getCount(ShieldStatus.AddedPOI);

  return {
    pending,
    allowed,
    blocked,
    addedPoi,
  };
};
