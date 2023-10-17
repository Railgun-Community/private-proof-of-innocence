import {
  NetworkName,
  POIEventLengths,
  POIEventType,
  TXIDVersion,
} from '@railgun-community/shared-models';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import { SignedPOIEvent } from '../models/poi-types';
import { verifyPOIEvent } from '../util/ed25519';
import { POIMerkletreeManager } from './poi-merkletree-manager';
import { TransactProofMempoolPruner } from '../proof-mempool/transact-proof-mempool-pruner';

export class POIEventList {
  static getTotalEventsLength(eventLengths: POIEventLengths): number {
    return Object.values(eventLengths).reduce((a, b) => a + b, 0);
  }

  static async getOverallEventsLength(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Promise<number> {
    const db = new POIOrderedEventsDatabase(networkName, txidVersion);
    return db.getCount(listKey);
  }

  static async getPOIEventLengths(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Promise<POIEventLengths> {
    const db = new POIOrderedEventsDatabase(networkName, txidVersion);
    return {
      [POIEventType.Shield]: await db.getCount(listKey, POIEventType.Shield),
      [POIEventType.Transact]: await db.getCount(
        listKey,
        POIEventType.Transact,
      ),
      [POIEventType.Unshield]: await db.getCount(
        listKey,
        POIEventType.Unshield,
      ),
      [POIEventType.LegacyTransact]: await db.getCount(
        listKey,
        POIEventType.LegacyTransact,
      ),
    };
  }

  static async getPOIListEventRange(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    startIndex: number,
    endIndex: number,
  ): Promise<SignedPOIEvent[]> {
    const db = new POIOrderedEventsDatabase(networkName, txidVersion);
    const dbEvents = await db.getPOIEvents(listKey, startIndex, endIndex);

    return dbEvents.map(dbEvent => {
      const { index, blindedCommitment, signature, type } = dbEvent;
      return {
        index,
        blindedCommitment,
        signature,
        type,
      };
    });
  }

  static async verifyAndAddSignedPOIEvents(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    signedPOIEvents: SignedPOIEvent[],
  ): Promise<void> {
    for (const signedPOIEvent of signedPOIEvents) {
      const verified = await verifyPOIEvent(signedPOIEvent, listKey);
      if (!verified) {
        throw new Error(`POI event failed verification`);
      }
      await POIEventList.addValidSignedPOIEvent(
        listKey,
        networkName,
        txidVersion,
        signedPOIEvent,
      );
    }
  }

  static async addValidSignedPOIEvent(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    signedPOIEvent: SignedPOIEvent,
  ) {
    try {
      await POIMerkletreeManager.addPOIEvent(
        listKey,
        networkName,
        txidVersion,
        signedPOIEvent,
      );

      const db = new POIOrderedEventsDatabase(networkName, txidVersion);
      await db.insertValidSignedPOIEvent(listKey, signedPOIEvent);

      await TransactProofMempoolPruner.removeProofIfAllOtherBlindedCommitmentsAdded(
        listKey,
        networkName,
        txidVersion,
        signedPOIEvent.blindedCommitment,
      );
    } catch {
      // no op
      return;
    }
  }
}
