import { NetworkName } from '@railgun-community/shared-models';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import { POIEventListStatus } from '../models/api-types';
import { SignedPOIEvent } from '../models/poi-types';
import { verifyPOIEvent } from '../util/ed25519';

export class POIEventList {
  static async getEventListStatus(
    networkName: NetworkName,
    listKey: string,
  ): Promise<POIEventListStatus> {
    const db = new POIOrderedEventsDatabase(networkName);
    const length = await db.getCount(listKey);

    return {
      length,
    };
  }

  static async getPOIListEventRange(
    networkName: NetworkName,
    listKey: string,
    startIndex: number,
    endIndex: number,
  ): Promise<SignedPOIEvent[]> {
    const db = new POIOrderedEventsDatabase(networkName);
    const dbEvents = await db.getPOIEvents(listKey, startIndex, endIndex);

    return dbEvents.map((dbEvent) => {
      const {
        index,
        blindedCommitmentStartingIndex,
        blindedCommitments,
        proof,
        signature,
      } = dbEvent;
      return {
        index,
        blindedCommitmentStartingIndex,
        blindedCommitments,
        proof,
        signature,
      };
    });
  }

  static async verifyAndAddSignedPOIEvents(
    networkName: NetworkName,
    listKey: string,
    signedPOIEvents: SignedPOIEvent[],
  ): Promise<void> {
    const db = new POIOrderedEventsDatabase(networkName);

    for (const signedPOIEvent of signedPOIEvents) {
      const verified = await verifyPOIEvent(signedPOIEvent, listKey);
      if (!verified) {
        throw new Error(`POI event failed verification`);
      }
      await db.insertValidSignedPOIEvent(listKey, signedPOIEvent);
    }
  }
}
