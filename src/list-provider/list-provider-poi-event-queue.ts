import {
  NetworkName,
  delay,
  isDefined,
} from '@railgun-community/shared-models';
import {
  POIEvent,
  POIEventShield,
  POIEventTransact,
  POIEventType,
  SignedPOIEvent,
  UnsignedPOIEvent,
} from '../models/poi-types';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import debug from 'debug';
import { signPOIEvent } from '../util/ed25519';
import {
  ShieldProofData,
  SnarkProof,
  TransactProofData,
} from '../models/proof-types';
import { POIEventList } from '../poi/poi-event-list';
import { Config } from '../config/config';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { ShieldStatus } from '../models/database-types';

const dbg = debug('poi:event-queue');

export class ListProviderPOIEventQueue {
  private isAddingPOIEventForNetwork: Partial<Record<NetworkName, boolean>> =
    {};

  private poiEventQueue: Partial<Record<NetworkName, POIEvent[]>> = {};

  private shouldPoll = false;

  private listKey: string;

  constructor(listKey: string) {
    this.listKey = listKey;
  }

  startPolling() {
    this.shouldPoll = true;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.poll();
  }

  stopPolling() {
    this.shouldPoll = false;
  }

  async poll() {
    if (!this.shouldPoll) {
      return;
    }

    for (const networkName of Config.NETWORK_NAMES) {
      await this.addPOIEventsFromQueue(networkName);
    }

    await delay(30000);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.poll();
  }

  queueUnsignedPOIShieldEvent(
    networkName: NetworkName,
    shieldProofData: ShieldProofData,
  ) {
    const poiEvent: POIEventShield = {
      type: POIEventType.Shield,
      blindedCommitments: [shieldProofData.blindedCommitment],
      proof: shieldProofData.snarkProof,
      commitmentHash: shieldProofData.commitmentHash,
    };
    return this.queuePOIEvent(networkName, poiEvent);
  }

  queueUnsignedPOITransactEvent(
    networkName: NetworkName,
    blindedCommitments: string[],
    proof: SnarkProof,
    transactProofData: TransactProofData,
  ) {
    const poiEvent: POIEventTransact = {
      type: POIEventType.Transact,
      blindedCommitments: transactProofData.blindedCommitmentOutputs,
      firstBlindedCommitment: transactProofData.blindedCommitmentOutputs[0],
      proof: transactProofData.snarkProof,
    };
    return this.queuePOIEvent(networkName, poiEvent);
  }

  private queuePOIEvent(networkName: NetworkName, poiEvent: POIEvent) {
    this.poiEventQueue[networkName] ??= [];

    const existingEvent = this.poiEventQueue[networkName]?.find(
      (e) => e.blindedCommitments[0] === poiEvent.blindedCommitments[0],
    );
    if (isDefined(existingEvent)) {
      return;
    }

    this.poiEventQueue[networkName]?.push(poiEvent);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.addPOIEventsFromQueue(networkName);
  }

  async addPOIEventsFromQueue(networkName: NetworkName): Promise<void> {
    // TODO-HIGH-PRI: Get sync status - make sure not currently syncing List from other nodes.
    // if () {
    //   dbg('WARNING: Tried to add POI event while adding another one - risk of duplicate indices. Skipping.');
    //   return;
    // }
    if (this.isAddingPOIEventForNetwork[networkName] === true) {
      return;
    }
    const queueForNetwork = this.poiEventQueue[networkName];
    if (!queueForNetwork || queueForNetwork.length === 0) {
      return;
    }

    const poiEvent = queueForNetwork.shift();
    if (!poiEvent) {
      return;
    }

    this.isAddingPOIEventForNetwork[networkName] = true;

    const orderedEventsDB = new POIOrderedEventsDatabase(networkName);
    const lastAddedItem = await orderedEventsDB.getLastAddedItem(this.listKey);

    const nextIndex = lastAddedItem ? lastAddedItem.index + 1 : 0;
    const blindedCommitmentStartingIndex = lastAddedItem
      ? lastAddedItem.blindedCommitmentStartingIndex +
        lastAddedItem.blindedCommitments.length
      : 0;

    const unsignedPOIEvent: UnsignedPOIEvent = {
      index: nextIndex,
      blindedCommitmentStartingIndex,
      blindedCommitments: poiEvent.blindedCommitments,
      proof: poiEvent.proof,
    };
    const signature = await signPOIEvent(unsignedPOIEvent);
    const signedPOIEvent: SignedPOIEvent = {
      ...unsignedPOIEvent,
      signature,
    };

    await POIEventList.addValidSignedPOIEvent(
      networkName,
      this.listKey,
      signedPOIEvent,
    );

    if (poiEvent.type === POIEventType.Shield) {
      const shieldQueueDB = new ShieldQueueDatabase(networkName);
      const shieldQueueDBItem = await shieldQueueDB.getAllowedShieldByHash(
        poiEvent.commitmentHash,
      );
      if (shieldQueueDBItem) {
        await shieldQueueDB.updateShieldStatus(
          shieldQueueDBItem,
          ShieldStatus.AddedPOI,
        );
      }
    }

    this.isAddingPOIEventForNetwork[networkName] = false;

    if (queueForNetwork.length > 0) {
      return this.addPOIEventsFromQueue(networkName);
    }
  }
}
