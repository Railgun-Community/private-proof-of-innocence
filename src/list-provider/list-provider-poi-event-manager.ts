import { NetworkName } from '@railgun-community/shared-models';
import { POIEvent, SignedPOIEvent } from '../models/poi-types';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import debug from 'debug';
import { signPOIEvent } from '../util/ed25519';
import { SnarkProof } from '../models/proof-types';
import { POIMerkletreeManager } from '../poi/poi-merkletree-manager';

const dbg = debug('poi:events');

type POIEventQueueItem = {
  blindedCommitments: string[];
  proof: SnarkProof;
};

export class ListProviderPOIEventManager {
  private static isAddingPOIEventForNetwork: Partial<
    Record<NetworkName, boolean>
  > = {};

  private static unsignedPOIEventQueue: Partial<
    Record<NetworkName, POIEventQueueItem[]>
  > = {};

  static async queueUnsignedPOIEvent(
    networkName: NetworkName,
    listKey: string,
    blindedCommitments: string[],
    proof: SnarkProof,
  ) {
    const poiEventQueueItem: POIEventQueueItem = {
      blindedCommitments,
      proof,
    };
    this.unsignedPOIEventQueue[networkName] ??= [];
    this.unsignedPOIEventQueue[networkName]?.push(poiEventQueueItem);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.addPOIEventsFromQueue(networkName, listKey);
  }

  static async addPOIEventsFromQueue(
    networkName: NetworkName,
    listKey: string,
  ): Promise<void> {
    // TODO-HIGH-PRI: Get sync status - make sure not currently syncing List from other nodes.
    // if () {
    //   dbg('WARNING: Tried to add POI event while adding another one - risk of duplicate indices. Skipping.');
    //   return;
    // }
    if (
      ListProviderPOIEventManager.isAddingPOIEventForNetwork[networkName] ===
      true
    ) {
      dbg(
        'WARNING: Tried to add POI event while adding another one - risk of duplicate indices. Skipping.',
      );
      return;
    }
    const queueForNetwork = this.unsignedPOIEventQueue[networkName];
    if (!queueForNetwork || queueForNetwork.length === 0) {
      return;
    }

    const nextEvent = queueForNetwork.shift();
    if (!nextEvent) {
      return;
    }

    ListProviderPOIEventManager.isAddingPOIEventForNetwork[networkName] = true;

    const db = new POIOrderedEventsDatabase(networkName);
    const lastAddedItem = await db.getLastAddedItem(listKey);

    const nextIndex = lastAddedItem ? lastAddedItem.index + 1 : 0;
    const blindedCommitmentStartingIndex = lastAddedItem
      ? lastAddedItem.blindedCommitmentStartingIndex +
        lastAddedItem.blindedCommitments.length
      : 0;

    const poiEvent: POIEvent = {
      index: nextIndex,
      blindedCommitmentStartingIndex,
      blindedCommitments: nextEvent.blindedCommitments,
      proof: nextEvent.proof,
    };
    const signature = await signPOIEvent(poiEvent);
    const signedPOIEvent: SignedPOIEvent = {
      ...poiEvent,
      signature,
    };

    await db.insertValidSignedPOIEvent(listKey, signedPOIEvent);

    await POIMerkletreeManager.addPOIEvent(
      listKey,
      networkName,
      signedPOIEvent,
    );

    ListProviderPOIEventManager.isAddingPOIEventForNetwork[networkName] = false;

    if (queueForNetwork.length > 0) {
      return this.addPOIEventsFromQueue(networkName, listKey);
    }
  }
}
