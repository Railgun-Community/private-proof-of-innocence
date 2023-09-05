import { NetworkName } from '@railgun-community/shared-models';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import { POIEventListStatus } from '../models/api-types';
import { SignedPOIEvent } from '../models/poi-types';

export const MAX_EVENT_QUERY_RANGE_LENGTH = 20;

export const getEventListStatus = async (
  networkName: NetworkName,
  listKey: string,
): Promise<POIEventListStatus> => {
  const db = new POIOrderedEventsDatabase(networkName);
  const length = await db.getCount(listKey);

  return {
    length,
  };
};

export const getPOIListEventRange = async (
  networkName: NetworkName,
  listKey: string,
  startIndex: number,
  endIndex: number,
): Promise<SignedPOIEvent[]> => {
  const rangeLength = endIndex - startIndex;
  if (rangeLength > MAX_EVENT_QUERY_RANGE_LENGTH) {
    throw new Error(
      `Max event query range length is ${MAX_EVENT_QUERY_RANGE_LENGTH}`,
    );
  }
  if (rangeLength < 1) {
    throw new Error(`Invalid query range`);
  }

  const db = new POIOrderedEventsDatabase(networkName);
  const dbEvents = await db.getPOIEvents(listKey, startIndex, endIndex);

  return dbEvents.map((dbEvent) => {
    const { index, blindedCommitments, proof, signature } = dbEvent;
    return {
      index,
      blindedCommitments,
      proof,
      signature,
    };
  });
};
