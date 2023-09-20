import { NetworkName } from '@railgun-community/shared-models';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import { SignedPOIEvent } from '../models/poi-types';
import { verifyPOIEvent } from '../util/ed25519';
import { POIMerkletreeManager } from './poi-merkletree-manager';
import { TransactProofMempoolPruner } from '../proof-mempool/transact-proof-mempool-pruner';

export class POIEventList {
  static async getPOIEventsLength(
    networkName: NetworkName,
    listKey: string,
  ): Promise<number> {
    const db = new POIOrderedEventsDatabase(networkName);
    const poiEventsLength = await db.getCount(listKey);
    return poiEventsLength;
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
        proof: proof ?? undefined,
        signature,
      };
    });
  }

  static async verifyAndAddSignedPOIEvents(
    networkName: NetworkName,
    listKey: string,
    signedPOIEvents: SignedPOIEvent[],
  ): Promise<void> {
    for (const signedPOIEvent of signedPOIEvents) {
      const verified = await verifyPOIEvent(signedPOIEvent, listKey);
      if (!verified) {
        throw new Error(`POI event failed verification`);
      }
      await POIEventList.addValidSignedPOIEvent(
        networkName,
        listKey,
        signedPOIEvent,
      );
    }
  }

  static async addValidSignedPOIEvent(
    networkName: NetworkName,
    listKey: string,
    signedPOIEvent: SignedPOIEvent,
  ) {
    await POIMerkletreeManager.addPOIEvent(
      listKey,
      networkName,
      signedPOIEvent,
    );

    const db = new POIOrderedEventsDatabase(networkName);
    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent);

    await TransactProofMempoolPruner.removeProof(
      listKey,
      networkName,
      signedPOIEvent.blindedCommitments[0],
    );
  }
}
