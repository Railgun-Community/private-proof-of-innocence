import { NetworkName } from '@railgun-community/shared-models';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { ShieldStatus } from '../models/database-types';
import TimeAgo from 'javascript-time-ago';

import en from 'javascript-time-ago/locale/en';
TimeAgo.addDefaultLocale(en);

export const MAX_EVENT_QUERY_RANGE_LENGTH = 20;

type ShieldQueueStatus = {
  pending: number;
  allowed: number;
  blocked: number;
  addedPoi: number;
  latestPendingShield: Optional<string>;
};

export const getShieldQueueStatus = async (
  networkName: NetworkName,
): Promise<ShieldQueueStatus> => {
  const db = new ShieldQueueDatabase(networkName);

  const pending = await db.getCount(ShieldStatus.Pending);
  const allowed = await db.getCount(ShieldStatus.Allowed);
  const blocked = await db.getCount(ShieldStatus.Blocked);
  const addedPoi = await db.getCount(ShieldStatus.AddedPOI);

  const timeAgo = new TimeAgo('en-US');

  const latestPendingShield = await db.getLatestPendingShield();
  const latestPendingShieldTime = latestPendingShield
    ? `${timeAgo.format(new Date(latestPendingShield.timestamp * 1000))}`
    : undefined;

  return {
    pending,
    allowed,
    blocked,
    addedPoi,
    latestPendingShield: latestPendingShieldTime,
  };
};
