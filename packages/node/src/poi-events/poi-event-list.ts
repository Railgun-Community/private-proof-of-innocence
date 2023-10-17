import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import { SignedPOIEvent } from '../models/poi-types';
import { verifyPOIEvent } from '../util/ed25519';
import { POIMerkletreeManager } from './poi-merkletree-manager';
import { TransactProofMempoolPruner } from '../proof-mempool/transact-proof-mempool-pruner';

export class POIEventList {
  static async getPOIEventsLength(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
  ): Promise<number> {
    const db = new POIOrderedEventsDatabase(networkName, txidVersion);
    const poiEventsLength = await db.getCount(listKey);
    return poiEventsLength;
  }

  static async getPOIListEventRange(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    startIndex: number,
    endIndex: number,
  ): Promise<SignedPOIEvent[]> {
    const db = new POIOrderedEventsDatabase(networkName, txidVersion);
    const dbEvents = await db.getPOIEvents(listKey, startIndex, endIndex);

    return dbEvents.map(dbEvent => {
      const { index, blindedCommitment, signature } = dbEvent;
      return {
        index,
        blindedCommitment,
        signature,
      };
    });
  }

  static async verifyAndAddSignedPOIEvents(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
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
        txidVersion,
        listKey,
        signedPOIEvent,
      );
    }
  }

  static async addValidSignedPOIEvent(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    signedPOIEvent: SignedPOIEvent,
  ) {
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
  }
}
