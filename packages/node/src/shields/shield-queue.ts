import {
  NetworkName,
  ShieldQueueStatus,
  TXIDVersion,
} from '@railgun-community/shared-models';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { ShieldStatus } from '../models/database-types';
import { getFormattedTimeAgo } from '../util/time-ago';

export const getShieldQueueStatus = async (
  networkName: NetworkName,
  txidVersion: TXIDVersion,
): Promise<ShieldQueueStatus> => {
  const db = new ShieldQueueDatabase(networkName, txidVersion);

  const unknown = await db.getCount(ShieldStatus.Unknown);
  const pending = await db.getCount(ShieldStatus.Pending);
  const allowed = await db.getCount(ShieldStatus.Allowed);
  const blocked = await db.getCount(ShieldStatus.Blocked);
  const addedPOI = await db.getCount(ShieldStatus.AddedPOI);

  const latestShield = await db.getLatestUnknownOrPendingShield();
  const latestShieldTime = latestShield
    ? `${getFormattedTimeAgo(new Date(latestShield.timestamp * 1000))}`
    : undefined;

  return {
    pending,
    allowed,
    blocked,
    addedPOI,
    unknown,
    latestShield: latestShieldTime,
  };
};
