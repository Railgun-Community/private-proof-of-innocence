import { NetworkName } from '@railgun-community/shared-models';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { ShieldStatus } from '../models/database-types';
import { getFormattedTimeAgo } from '../util/time-ago';

export const MAX_EVENT_QUERY_RANGE_LENGTH = 20;

type ShieldQueueStatus = {
  pending: number;
  allowed: number;
  blocked: number;
  addedPOI: number;
  latestPendingShield: Optional<string>;
};

export const getShieldQueueStatus = async (
  networkName: NetworkName,
): Promise<ShieldQueueStatus> => {
  const db = new ShieldQueueDatabase(networkName);

  const pending = await db.getCount(ShieldStatus.Pending);
  const allowed = await db.getCount(ShieldStatus.Allowed);
  const blocked = await db.getCount(ShieldStatus.Blocked);
  const addedPOI = await db.getCount(ShieldStatus.AddedPOI);

  const latestPendingShield = await db.getLatestPendingShield();
  const latestPendingShieldTime = latestPendingShield
    ? `${getFormattedTimeAgo(new Date(latestPendingShield.timestamp * 1000))}`
    : undefined;

  return {
    pending,
    allowed,
    blocked,
    addedPOI,
    latestPendingShield: latestPendingShieldTime,
  };
};
