import {
  NetworkName,
  POIEventLengths,
  POIEventType,
  TXIDVersion,
  isDefined,
  removeUndefineds,
} from '@railgun-community/shared-models';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import { POISyncedListEvent, SignedPOIEvent } from '../models/poi-types';
import { verifyPOIEvent } from '../util/ed25519';
import { POIMerkletreeManager } from './poi-merkletree-manager';
import { TransactProofMempoolPruner } from '../proof-mempool/transact-proof-mempool-pruner';
import debug from 'debug';
import { POIMerkletreeDatabase } from '../database/databases/poi-merkletree-database';
import { POIHistoricalMerklerootDatabase } from '../database/databases/poi-historical-merkleroot-database';

const dbg = debug('poi:event-list');

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

  static async getMissingEventIndices(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Promise<number[]> {
    const db = new POIOrderedEventsDatabase(networkName, txidVersion);
    const stream = await db.streamOrdered(listKey);

    const missingIndices: number[] = [];

    let index = 0;

    for await (const orderedEvent of stream) {
      if (orderedEvent.index !== index) {
        missingIndices.push(index);
        index += 1;
      }
      index += 1;
    }

    return missingIndices;
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
  ): Promise<POISyncedListEvent[]> {
    const db = new POIOrderedEventsDatabase(networkName, txidVersion);
    const dbEvents = await db.getPOIEvents(listKey, startIndex, endIndex);

    return removeUndefineds(
      await Promise.all(
        dbEvents.map(async dbEvent => {
          const { index, blindedCommitment, signature, type } = dbEvent;

          const historicalMerkleroot =
            await POIMerkletreeManager.getHistoricalMerkleroot(
              listKey,
              networkName,
              txidVersion,
              index,
            );

          if (!isDefined(historicalMerkleroot)) {
            dbg(
              `WARNING: No historical merkleroot for list ${listKey} network ${networkName}, index ${index}`,
            );
            return undefined;
          }

          return {
            signedPOIEvent: {
              index,
              blindedCommitment,
              signature,
              type,
            },
            validatedMerkleroot: historicalMerkleroot,
          };
        }),
      ),
    );
  }

  static async verifyAndAddSignedPOIEventsWithValidatedMerkleroots(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    poiListSyncedEvents: POISyncedListEvent[],
  ): Promise<void> {
    for (const { signedPOIEvent, validatedMerkleroot } of poiListSyncedEvents) {
      const verified = await verifyPOIEvent(signedPOIEvent, listKey);
      if (!verified) {
        throw new Error(`POI event failed verification`);
      }
      await POIEventList.addValidSignedPOIEvent(
        listKey,
        networkName,
        txidVersion,
        signedPOIEvent,
        validatedMerkleroot,
      );
    }
  }

  static async addValidSignedPOIEvent(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    signedPOIEvent: SignedPOIEvent,
    validatedMerkleroot: string,
  ) {
    return this.addValidSignedPOIEventOptionalValidatedMerkleroot(
      listKey,
      networkName,
      txidVersion,
      signedPOIEvent,
      validatedMerkleroot,
    );
  }

  static async addValidSignedPOIEventOwnedList(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    signedPOIEvent: SignedPOIEvent,
  ) {
    return this.addValidSignedPOIEventOptionalValidatedMerkleroot(
      listKey,
      networkName,
      txidVersion,
      signedPOIEvent,
      undefined,
    );
  }

  private static async addValidSignedPOIEventOptionalValidatedMerkleroot(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    signedPOIEvent: SignedPOIEvent,
    validatedMerkleroot: Optional<string>,
  ) {
    try {
      await POIMerkletreeManager.addPOIEvent(
        listKey,
        networkName,
        txidVersion,
        signedPOIEvent,
        validatedMerkleroot,
      );

      const db = new POIOrderedEventsDatabase(networkName, txidVersion);
      await db.insertValidSignedPOIEvent(listKey, signedPOIEvent);

      await TransactProofMempoolPruner.removeProofIfAllOtherBlindedCommitmentsAdded(
        listKey,
        networkName,
        txidVersion,
        signedPOIEvent.blindedCommitment,
      );
    } catch (err) {
      // no op
      dbg(err);
      throw err;
    }
  }

  static async deleteAllPOIEventsForList_DANGEROUS(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ) {
    const eventsDB = new POIOrderedEventsDatabase(networkName, txidVersion);
    await eventsDB.deleteAllEventsForList_DANGEROUS(listKey);

    const poiMerkletreeDB = new POIMerkletreeDatabase(networkName, txidVersion);
    await poiMerkletreeDB.deleteAllPOIMerkletreeNodesForList_DANGEROUS(listKey);

    const poiMerklerootDB = new POIHistoricalMerklerootDatabase(
      networkName,
      txidVersion,
    );
    await poiMerklerootDB.deleteAllPOIMerklerootsForList_DANGEROUS(listKey);
  }
}
