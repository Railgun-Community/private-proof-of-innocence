import {
  NetworkName,
  delay,
  isDefined,
  TransactProofData,
  TXIDVersion,
  LegacyTransactProofData,
} from '@railgun-community/shared-models';
import {
  POIEvent,
  POIEventLegacyTransact,
  POIEventShield,
  POIEventTransact,
  POIEventType,
  SignedPOIEvent,
} from '../models/poi-types';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import {
  signPOIEventLegacyTransact,
  signPOIEventShield,
  signPOIEventTransact,
} from '../util/ed25519';
import { POIEventList } from '../poi-events/poi-event-list';
import { Config } from '../config/config';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { ShieldStatus } from '../models/database-types';
import debug from 'debug';
import { POINodeRequest } from '../api/poi-node-request';
import { PushSync } from '../sync/push-sync';
import { hexToBigInt } from '@railgun-community/wallet';

const dbg = debug('poi:event-queue');

export class ListProviderPOIEventQueue {
  private static isAddingPOIEventForNetwork: Partial<
    Record<NetworkName, boolean>
  > = {};

  private static poiEventQueue: Partial<
    Record<NetworkName, Record<TXIDVersion, POIEvent[]>>
  > = {};

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
      for (const txidVersion of Config.TXID_VERSIONS) {
        await ListProviderPOIEventQueue.addPOIEventsFromQueue(
          networkName,
          txidVersion,
        );
      }
    }

    await delay(30000);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ListProviderPOIEventQueue.poll();
  }

  static getPOIEventQueueLength(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Optional<number> {
    return this.poiEventQueue[networkName]?.[txidVersion]?.length;
  }

  static queueUnsignedPOIShieldEvent(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    poiEventShield: POIEventShield,
  ) {
    dbg(
      `Queue shield event - blinded commitment ${poiEventShield.blindedCommitment}`,
    );
    return ListProviderPOIEventQueue.queuePOIEvent(
      networkName,
      txidVersion,
      poiEventShield,
    );
  }

  static queueUnsignedPOITransactEvent(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ) {
    const blindedCommitmentsOut =
      transactProofData.blindedCommitmentsOut.filter(blindedCommitment => {
        return hexToBigInt(blindedCommitment) !== 0n;
      });
    if (hexToBigInt(transactProofData.railgunTxidIfHasUnshield) !== 0n) {
      blindedCommitmentsOut.push(transactProofData.railgunTxidIfHasUnshield);
    }

    dbg(
      `Queue transact event - first blinded commitment ${blindedCommitmentsOut[0]}`,
    );

    const poiEvent: POIEventTransact = {
      type: POIEventType.Transact,
      blindedCommitments: blindedCommitmentsOut,
      proof: transactProofData.snarkProof,
    };
    return ListProviderPOIEventQueue.queuePOIEvent(
      networkName,
      txidVersion,
      poiEvent,
    );
  }

  static queueUnsignedPOILegacyTransactEvent(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    legacyTransactProofData: LegacyTransactProofData,
  ) {
    dbg(
      `Queue legacy transact event - blinded commitment ${legacyTransactProofData.blindedCommitment}`,
    );

    const poiEvent: POIEventLegacyTransact = {
      type: POIEventType.LegacyTransact,
      blindedCommitment: legacyTransactProofData.blindedCommitment,
    };
    return ListProviderPOIEventQueue.queuePOIEvent(
      networkName,
      txidVersion,
      poiEvent,
    );
  }

  private static getPOIEventFirstBlindedCommitment(poiEvent: POIEvent) {
    switch (poiEvent.type) {
      case POIEventType.LegacyTransact:
      case POIEventType.Shield:
        return poiEvent.blindedCommitment;
      case POIEventType.Transact:
        return poiEvent.blindedCommitments[0];
    }
  }

  private static queuePOIEvent(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    poiEvent: POIEvent,
  ) {
    ListProviderPOIEventQueue.poiEventQueue[networkName] ??= {
      [TXIDVersion.V2_PoseidonMerkle]: [],
    };

    const queue =
      ListProviderPOIEventQueue.poiEventQueue[networkName]?.[txidVersion];

    const existingEvent = queue?.find(e => {
      return (
        ListProviderPOIEventQueue.getPOIEventFirstBlindedCommitment(e) ===
        ListProviderPOIEventQueue.getPOIEventFirstBlindedCommitment(poiEvent)
      );
    });
    if (isDefined(existingEvent)) {
      dbg(`Event exists in queue... ignore`);
      return;
    }

    queue?.push(poiEvent);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ListProviderPOIEventQueue.addPOIEventsFromQueue(networkName, txidVersion);
  }

  private static getMinimumNextAddIndex(networkName: NetworkName) {
    return ListProviderPOIEventQueue.minimumNextAddIndex[networkName] ?? 0;
  }

  static tryUpdateMinimumNextAddIndex(
    listKey: string,
    networkName: NetworkName,
    syncedIndex: number,
  ) {
    if (listKey !== this.listKey) {
      return;
    }
    ListProviderPOIEventQueue.minimumNextAddIndex[networkName] = Math.max(
      ListProviderPOIEventQueue.getMinimumNextAddIndex(networkName),
      syncedIndex,
    );
  }

  static async createSignedPOIEvent(
    index: number,
    blindedCommitmentStartingIndex: number,
    poiEvent: POIEvent,
  ) {
    switch (poiEvent.type) {
      case POIEventType.Shield:
        return ListProviderPOIEventQueue.createSignedPOIShieldEvent(
          index,
          blindedCommitmentStartingIndex,
          poiEvent,
        );
      case POIEventType.Transact:
        return ListProviderPOIEventQueue.createSignedPOITransactEvent(
          index,
          blindedCommitmentStartingIndex,
          poiEvent,
        );
      case POIEventType.LegacyTransact:
        return ListProviderPOIEventQueue.createSignedPOILegacyTransactEvent(
          index,
          blindedCommitmentStartingIndex,
          poiEvent,
        );
    }
  }

  private static async createSignedPOIShieldEvent(
    index: number,
    blindedCommitmentStartingIndex: number,
    poiEventShield: POIEventShield,
  ): Promise<SignedPOIEvent> {
    const signature = await signPOIEventShield(
      index,
      blindedCommitmentStartingIndex,
      poiEventShield,
    );
    return {
      index,
      blindedCommitmentStartingIndex,
      blindedCommitments: [poiEventShield.blindedCommitment],
      proof: undefined,
      signature,
    };
  }

  static async createSignedPOITransactEvent(
    index: number,
    blindedCommitmentStartingIndex: number,
    poiEventTransact: POIEventTransact,
  ): Promise<SignedPOIEvent> {
    const signature = await signPOIEventTransact(
      index,
      blindedCommitmentStartingIndex,
      poiEventTransact,
    );
    return {
      index,
      blindedCommitmentStartingIndex,
      blindedCommitments: poiEventTransact.blindedCommitments,
      proof: poiEventTransact.proof,
      signature,
    };
  }

  static async createSignedPOILegacyTransactEvent(
    index: number,
    blindedCommitmentStartingIndex: number,
    poiEventLegacyTransact: POIEventLegacyTransact,
  ): Promise<SignedPOIEvent> {
    const signature = await signPOIEventLegacyTransact(
      index,
      blindedCommitmentStartingIndex,
      poiEventLegacyTransact,
    );
    return {
      index,
      blindedCommitmentStartingIndex,
      blindedCommitments: [poiEventLegacyTransact.blindedCommitment],
      proof: undefined,
      signature,
    };
  }

  static async addPOIEventsFromQueue(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Promise<void> {
    const queue =
      ListProviderPOIEventQueue.poiEventQueue[networkName]?.[txidVersion];
    if (!queue || queue.length === 0) {
      return;
    }
    if (
      ListProviderPOIEventQueue.isAddingPOIEventForNetwork[networkName] === true
    ) {
      dbg(`Warning: Already adding events from queue`);
      return;
    }

    ListProviderPOIEventQueue.isAddingPOIEventForNetwork[networkName] = true;

    try {
      const orderedEventsDB = new POIOrderedEventsDatabase(
        networkName,
        txidVersion,
      );
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

      const poiEvent = queue[0];

      if (
        await orderedEventsDB.eventExists(
          ListProviderPOIEventQueue.listKey,
          ListProviderPOIEventQueue.getPOIEventFirstBlindedCommitment(poiEvent),
        )
      ) {
        queue.splice(0, 1);
        throw new Error('Event already exists in database');
      }

      const blindedCommitmentStartingIndex = lastAddedItem
        ? lastAddedItem.blindedCommitmentStartingIndex +
          lastAddedItem.blindedCommitments.length
        : 0;
      const signedPOIEvent: SignedPOIEvent = await this.createSignedPOIEvent(
        nextIndex,
        blindedCommitmentStartingIndex,
        poiEvent,
      );

      await POIEventList.addValidSignedPOIEvent(
        networkName,
        txidVersion,
        ListProviderPOIEventQueue.listKey,
        signedPOIEvent,
      );

      // Remove item
      queue.splice(0, 1);

      if (poiEvent.type === POIEventType.Shield) {
        const shieldQueueDB = new ShieldQueueDatabase(networkName, txidVersion);
        const shieldQueueDBItem =
          await shieldQueueDB.getAllowedShieldByCommitmentHash(
            poiEvent.commitmentHash,
          );
        if (shieldQueueDBItem) {
          await shieldQueueDB.updateShieldStatus(
            shieldQueueDBItem,
            ShieldStatus.AddedPOI,
          );
        }
      }

      await PushSync.sendNodeRequestToAllNodes(async nodeURL => {
        await POINodeRequest.submitPOIEvent(
          nodeURL,
          networkName,
          txidVersion,
          ListProviderPOIEventQueue.listKey,
          signedPOIEvent,
        );
      });

      ListProviderPOIEventQueue.isAddingPOIEventForNetwork[networkName] = false;

      if (queue.length > 0) {
        return await ListProviderPOIEventQueue.addPOIEventsFromQueue(
          networkName,
          txidVersion,
        );
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg('Error adding POI event from queue', err.message);
      ListProviderPOIEventQueue.isAddingPOIEventForNetwork[networkName] = false;
    }
  }
}
