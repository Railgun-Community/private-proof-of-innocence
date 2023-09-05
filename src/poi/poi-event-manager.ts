import { NetworkName, isDefined } from '@railgun-community/shared-models';
import { POIEvent, SignedPOIEvent } from '../models/poi-types';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import { SerializedSnarkProof } from '../models/general-types';
import debug from 'debug';
import { signPOIEvent } from '../util/ed25519';

const dbg = debug('poi:events');

type POIEventQueueItem = {
  blindedCommitments: string[];
  proof: SerializedSnarkProof;
};

export class POIEventManager {
  private static isAddingPOIEventForNetwork: Partial<
    Record<NetworkName, boolean>
  > = {};

  private static unsignedPOIEventQueue: Partial<
    Record<NetworkName, POIEventQueueItem[]>
  > = {};

  static async queueValidUnsignedPOIEvent(
    networkName: NetworkName,
    blindedCommitments: string[],
    proof: SerializedSnarkProof,
  ) {
    const poiEventQueueItem: POIEventQueueItem = {
      blindedCommitments,
      proof,
    };
    this.unsignedPOIEventQueue[networkName] ??= [];
    this.unsignedPOIEventQueue[networkName]?.push(poiEventQueueItem);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.addPOIEventsFromQueue(networkName);
  }

  static async addPOIEventsFromQueue(networkName: NetworkName): Promise<void> {
    // TODO: Get sync status - make sure not currently syncing List from other nodes.
    // if () {
    //   dbg('WARNING: Tried to add POI event while adding another one - risk of duplicate indices. Skipping.');
    //   return;
    // }
    if (POIEventManager.isAddingPOIEventForNetwork[networkName] === true) {
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

    POIEventManager.isAddingPOIEventForNetwork[networkName] = true;

    const db = new POIOrderedEventsDatabase(networkName);
    const index = await db.getNextIndex();

    const poiEvent: POIEvent = {
      index,
      blindedCommitments: nextEvent.blindedCommitments,
      proof: nextEvent.proof,
    };
    const signature = await signPOIEvent(poiEvent);
    const signedPOIEvent: SignedPOIEvent = {
      ...poiEvent,
      signature,
    };

    await db.insertValidSignedPOIEvent(signedPOIEvent);

    POIEventManager.isAddingPOIEventForNetwork[networkName] = false;

    if (queueForNetwork.length > 0) {
      return this.addPOIEventsFromQueue(networkName);
    }
  }
}