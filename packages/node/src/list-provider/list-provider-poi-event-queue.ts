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
import debug from 'debug';

const dbg = debug('poi:event-queue');

export class ListProviderPOIEventQueue {
  private static isAddingPOIEventForNetwork: Partial<
    Record<NetworkName, boolean>
  > = {};

  private static poiEventQueue: Partial<Record<NetworkName, POIEvent[]>> = {};

  private static minimumNextAddIndex: Partial<Record<NetworkName, number>> = {};

  static listKey: string;

  static init(listKey: string) {
    ListProviderPOIEventQueue.listKey = listKey;
  }

  static startPolling() {
    if (!ListProviderPOIEventQueue.listKey) {
      throw new Error('Must call ListProviderPOIEventQueue.init');
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ListProviderPOIEventQueue.poll();
  }

  private static async poll() {
    for (const networkName of Config.NETWORK_NAMES) {
      await ListProviderPOIEventQueue.addPOIEventsFromQueue(networkName);
    }

    await delay(30000);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ListProviderPOIEventQueue.poll();
  }

  static getPOIEventQueueLength(networkName: NetworkName): Optional<number> {
    return this.poiEventQueue[networkName]?.length;
  }

  static queueUnsignedPOIShieldEvent(
    networkName: NetworkName,
    shieldProofData: ShieldProofData,
  ) {
    const poiEvent: POIEventShield = {
      type: POIEventType.Shield,
      blindedCommitments: [shieldProofData.blindedCommitment],
      proof: shieldProofData.snarkProof,
      commitmentHash: shieldProofData.commitmentHash,
    };
    return ListProviderPOIEventQueue.queuePOIEvent(networkName, poiEvent);
  }

  static queueUnsignedPOITransactEvent(
    networkName: NetworkName,
    transactProofData: TransactProofData,
  ) {
    const poiEvent: POIEventTransact = {
      type: POIEventType.Transact,
      blindedCommitments: transactProofData.blindedCommitmentOutputs,
      firstBlindedCommitment: transactProofData.blindedCommitmentOutputs[0],
      proof: transactProofData.snarkProof,
    };
    return ListProviderPOIEventQueue.queuePOIEvent(networkName, poiEvent);
  }

  private static queuePOIEvent(networkName: NetworkName, poiEvent: POIEvent) {
    ListProviderPOIEventQueue.poiEventQueue[networkName] ??= [];

    const existingEvent = ListProviderPOIEventQueue.poiEventQueue[
      networkName
    ]?.find((e) => e.blindedCommitments[0] === poiEvent.blindedCommitments[0]);
    if (isDefined(existingEvent)) {
      return;
    }

    ListProviderPOIEventQueue.poiEventQueue[networkName]?.push(poiEvent);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ListProviderPOIEventQueue.addPOIEventsFromQueue(networkName);
  }

  private static getMinimumNextAddIndex(networkName: NetworkName) {
    return ListProviderPOIEventQueue.minimumNextAddIndex[networkName] ?? 0;
  }

  static updateMinimumNextAddIndex(
    networkName: NetworkName,
    syncedIndex: number,
  ) {
    ListProviderPOIEventQueue.minimumNextAddIndex[networkName] = Math.max(
      ListProviderPOIEventQueue.getMinimumNextAddIndex(networkName),
      syncedIndex,
    );
  }

  static async createSignedPOIEvent(
    index: number,
    blindedCommitmentStartingIndex: number,
    blindedCommitments: string[],
    proof: SnarkProof,
  ): Promise<SignedPOIEvent> {
    const unsignedPOIEvent: UnsignedPOIEvent = {
      index,
      blindedCommitmentStartingIndex,
      blindedCommitments,
      proof,
    };
    const signature = await signPOIEvent(unsignedPOIEvent);
    return {
      ...unsignedPOIEvent,
      signature,
    };
  }

  static async addPOIEventsFromQueue(networkName: NetworkName): Promise<void> {
    if (
      ListProviderPOIEventQueue.isAddingPOIEventForNetwork[networkName] === true
    ) {
      return;
    }
    ListProviderPOIEventQueue.isAddingPOIEventForNetwork[networkName] = true;

    try {
      const orderedEventsDB = new POIOrderedEventsDatabase(networkName);
      const lastAddedItem = await orderedEventsDB.getLastAddedItem(
        ListProviderPOIEventQueue.listKey,
      );
      const nextIndex = lastAddedItem ? lastAddedItem.index + 1 : 0;
      if (
        nextIndex > 0 &&
        nextIndex <=
          ListProviderPOIEventQueue.getMinimumNextAddIndex(networkName)
      ) {
        throw new Error(
          'Tried to add POI event while unsynced - risk of duplicate indices. Skipping until synced.',
        );
      }

      const queueForNetwork =
        ListProviderPOIEventQueue.poiEventQueue[networkName];
      if (!queueForNetwork || queueForNetwork.length === 0) {
        throw new Error('No events in queue');
      }

      const poiEvent = queueForNetwork[0];

      if (
        await orderedEventsDB.eventExists(
          ListProviderPOIEventQueue.listKey,
          poiEvent.blindedCommitments[0],
        )
      ) {
        queueForNetwork.splice(0, 1);
        throw new Error('Event already exists in database');
      }

      const blindedCommitmentStartingIndex = lastAddedItem
        ? lastAddedItem.blindedCommitmentStartingIndex +
          lastAddedItem.blindedCommitments.length
        : 0;
      const signedPOIEvent: SignedPOIEvent = await this.createSignedPOIEvent(
        nextIndex,
        blindedCommitmentStartingIndex,
        poiEvent.blindedCommitments,
        poiEvent.proof,
      );

      await POIEventList.addValidSignedPOIEvent(
        networkName,
        ListProviderPOIEventQueue.listKey,
        signedPOIEvent,
      );

      // Remove item
      queueForNetwork.splice(0, 1);

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

      ListProviderPOIEventQueue.isAddingPOIEventForNetwork[networkName] = false;

      if (queueForNetwork.length > 0) {
        return await ListProviderPOIEventQueue.addPOIEventsFromQueue(
          networkName,
        );
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg('Error adding POI event from queue', err.message);
      ListProviderPOIEventQueue.isAddingPOIEventForNetwork[networkName] = false;
    }
  }
}
