import {
  NetworkName,
  delay,
  isDefined,
  TransactProofData,
  TXIDVersion,
  LegacyTransactProofData,
  POIEventType,
} from '@railgun-community/shared-models';
import {
  POIEvent,
  POIEventLegacyTransact,
  POIEventShield,
  POIEventTransact,
  POIEventUnshield,
  SignedPOIEvent,
} from '../models/poi-types';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import { signPOIEvent } from '../util/ed25519';
import { POIEventList } from '../poi-events/poi-event-list';
import { Config } from '../config/config';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { ShieldStatus } from '../models/database-types';
import debug from 'debug';
import { POINodeRequest } from '../api/poi-node-request';
import { PushSync } from '../sync/push-sync';
import { hexToBigInt } from '@railgun-community/wallet';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';
import { generateKey } from '../util/util';

const dbg = debug('poi:event-queue');

export class ListProviderPOIEventQueue {
  private static addingPOIEventKeyForNetworkAndTXIDVersion: Partial<
    Record<NetworkName, Partial<Record<TXIDVersion, string>>>
  > = {};

  private static poiEventQueue: Partial<
    Record<NetworkName, Record<TXIDVersion, POIEvent[]>>
  > = {};

  private static minimumNextAddIndex: Partial<
    Record<NetworkName, Partial<Record<TXIDVersion, number>>>
  > = {};

  static listKey: string;

  static ready = false;

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

  static clearEventQueue_TestOnly(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ) {
    const eventQueueForNetwork = this.poiEventQueue[networkName];
    if (eventQueueForNetwork) {
      eventQueueForNetwork[txidVersion] = [];
    }
  }

  static clearMinimumNextAddIndex_TestOnly() {
    this.minimumNextAddIndex = {};
  }

  static getPOIEventQueueLength(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Optional<number> {
    return this.poiEventQueue[networkName]?.[txidVersion]?.length;
  }

  static queueUnsignedPOIShieldEvent(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    poiEventShield: POIEventShield,
  ) {
    if (ListProviderPOIEventQueue.listKey !== listKey) {
      return;
    }

    dbg(
      `Queue shield event [${networkName}, ${txidVersion}] - blinded commitment ${poiEventShield.blindedCommitment}`,
    );
    return ListProviderPOIEventQueue.queuePOIEvent(
      networkName,
      txidVersion,
      poiEventShield,
    );
  }

  static queueUnsignedPOISingleCommitmentEvent(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitment: string,
  ) {
    if (ListProviderPOIEventQueue.listKey !== listKey) {
      return;
    }

    dbg(
      `Queue single commitment event [${networkName}, ${txidVersion}] - blinded commitment ${blindedCommitment}`,
    );

    const poiEvent: POIEventTransact = {
      type: POIEventType.Transact,
      blindedCommitment,
    };
    return ListProviderPOIEventQueue.queuePOIEvent(
      networkName,
      txidVersion,
      poiEvent,
    );
  }

  static queueUnsignedPOITransactEvent(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ) {
    if (ListProviderPOIEventQueue.listKey !== listKey) {
      return;
    }

    // Add transact proofs
    transactProofData.blindedCommitmentsOut
      .filter(blindedCommitment => {
        return hexToBigInt(blindedCommitment) !== 0n;
      })
      .forEach(blindedCommitment => {
        dbg(
          `Queue transact event [${networkName}, ${txidVersion}] - blinded commitment ${blindedCommitment}`,
        );

        const poiEvent: POIEventTransact = {
          type: POIEventType.Transact,
          blindedCommitment,
        };
        return ListProviderPOIEventQueue.queuePOIEvent(
          networkName,
          txidVersion,
          poiEvent,
        );
      });

    // Add unshield proof if it exists. Blinded commitment === railgunTxidIfHasUnshield.
    if (hexToBigInt(transactProofData.railgunTxidIfHasUnshield) !== 0n) {
      const poiEvent: POIEventUnshield = {
        type: POIEventType.Unshield,
        blindedCommitment: transactProofData.railgunTxidIfHasUnshield,
      };
      return ListProviderPOIEventQueue.queuePOIEvent(
        networkName,
        txidVersion,
        poiEvent,
      );
    }
  }

  static queueUnsignedPOILegacyTransactEvent(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    legacyTransactProofData: LegacyTransactProofData,
  ) {
    if (ListProviderPOIEventQueue.listKey !== listKey) {
      return;
    }

    dbg(
      `Queue legacy transact event [${networkName}, ${txidVersion}] - blinded commitment ${legacyTransactProofData.blindedCommitment}`,
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

  private static queuePOIEvent(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    poiEvent: POIEvent,
  ) {
    ListProviderPOIEventQueue.poiEventQueue[networkName] ??=
      Config.TXID_VERSIONS.reduce(
        (acc, txidVersion) => {
          acc[txidVersion] = [];
          return acc;
        },
        {} as Record<TXIDVersion, POIEvent[]>,
      );

    const queue =
      ListProviderPOIEventQueue.poiEventQueue[networkName]?.[txidVersion];

    const existingEvent = queue?.find(e => {
      return e.blindedCommitment === poiEvent.blindedCommitment;
    });
    if (isDefined(existingEvent)) {
      dbg(
        `Event exists in queue [${networkName}, ${txidVersion}]... ignore new event, but retrigger add-from-queue`,
      );
    } else {
      queue?.push(poiEvent);
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ListProviderPOIEventQueue.addPOIEventsFromQueue(networkName, txidVersion);
  }

  private static getMinimumNextAddIndex(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ) {
    return (
      ListProviderPOIEventQueue.minimumNextAddIndex[networkName]?.[
        txidVersion
      ] ?? 0
    );
  }

  static tryUpdateMinimumNextAddIndex(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    syncedIndex: number,
  ) {
    if (listKey !== this.listKey) {
      return;
    }

    if (
      !isDefined(ListProviderPOIEventQueue.minimumNextAddIndex[networkName])
    ) {
      ListProviderPOIEventQueue.minimumNextAddIndex[networkName] = {};
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ListProviderPOIEventQueue.minimumNextAddIndex[networkName]![txidVersion] =
      Math.max(
        ListProviderPOIEventQueue.getMinimumNextAddIndex(
          networkName,
          txidVersion,
        ),
        syncedIndex,
      );
  }

  static async createSignedPOIEvent(
    index: number,
    poiEvent: POIEvent,
  ): Promise<SignedPOIEvent> {
    const signature = await signPOIEvent(index, poiEvent);
    return {
      index,
      blindedCommitment: poiEvent.blindedCommitment,
      signature,
      type: poiEvent.type,
    };
  }

  static setAddingPOIEventKey(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    key: Optional<string>,
  ) {
    if (
      !isDefined(
        ListProviderPOIEventQueue.addingPOIEventKeyForNetworkAndTXIDVersion[
          networkName
        ],
      )
    ) {
      ListProviderPOIEventQueue.addingPOIEventKeyForNetworkAndTXIDVersion[
        networkName
      ] = {};
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    ListProviderPOIEventQueue.addingPOIEventKeyForNetworkAndTXIDVersion[
      networkName
    ]![txidVersion] = key;
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
      isDefined(
        ListProviderPOIEventQueue.addingPOIEventKeyForNetworkAndTXIDVersion[
          networkName
        ]?.[txidVersion],
      )
    ) {
      dbg(
        `Warning: Already adding events from queue [${networkName}, ${txidVersion}]`,
      );
      return;
    }
    if (!this.ready) {
      dbg(
        `Warning: Not ready to add events to list [${networkName}, ${txidVersion}]`,
      );
      return;
    }

    const currentEventKey = generateKey();

    ListProviderPOIEventQueue.setAddingPOIEventKey(
      networkName,
      txidVersion,
      currentEventKey,
    );

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
        nextIndex <
        ListProviderPOIEventQueue.getMinimumNextAddIndex(
          networkName,
          txidVersion,
        )
      ) {
        throw new Error(
          `Tried to add POI event while unsynced - risk of duplicate indices. Skipping until synced. [${networkName}, ${txidVersion}]`,
        );
      }

      const poiEvent = queue[0];

      if (
        await orderedEventsDB.eventExists(
          ListProviderPOIEventQueue.listKey,
          poiEvent.blindedCommitment,
        )
      ) {
        dbg(
          `Event already exists in list. Skipping adding POI event from queue. [${networkName}, ${txidVersion}]`,
        );

        // Remove item from queue.
        queue.splice(0, 1);

        ListProviderPOIEventQueue.setAddingPOIEventKey(
          networkName,
          txidVersion,
          undefined, // key
        );

        if (queue.length > 0) {
          await ListProviderPOIEventQueue.addPOIEventsFromQueue(
            networkName,
            txidVersion,
          );
        }
        return;
      }

      const signedPOIEvent: SignedPOIEvent = await this.createSignedPOIEvent(
        nextIndex,
        poiEvent,
      );

      if (
        currentEventKey !==
        ListProviderPOIEventQueue.addingPOIEventKeyForNetworkAndTXIDVersion[
          networkName
        ]?.[txidVersion]
      ) {
        dbg(
          `Warning: Key mismatch. Skipping adding POI event from queue. [${networkName}, ${txidVersion}]`,
        );
        return;
      }

      dbg(
        `Adding POI event to list from queue [${networkName}, ${txidVersion}]: ${nextIndex}`,
      );

      await POIEventList.addValidSignedPOIEventOwnedList(
        ListProviderPOIEventQueue.listKey,
        networkName,
        txidVersion,
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

      const merkleroot = await POIMerkletreeManager.getHistoricalMerkleroot(
        this.listKey,
        networkName,
        txidVersion,
        signedPOIEvent.index,
      );
      if (isDefined(merkleroot)) {
        await PushSync.sendNodeRequestToAllNodes(async nodeURL => {
          await POINodeRequest.submitPOIEvent(
            nodeURL,
            networkName,
            txidVersion,
            ListProviderPOIEventQueue.listKey,
            signedPOIEvent,
            merkleroot, // validatedMerkleroot
          );
        });
      }

      ListProviderPOIEventQueue.setAddingPOIEventKey(
        networkName,
        txidVersion,
        undefined, // key
      );

      if (queue.length > 0) {
        // Continue with next item in queue.
        await ListProviderPOIEventQueue.addPOIEventsFromQueue(
          networkName,
          txidVersion,
        );
        return;
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(
        `Error adding POI event from queue [${networkName}, ${txidVersion}]`,
        err.message,
      );
      if (
        currentEventKey ===
        ListProviderPOIEventQueue.addingPOIEventKeyForNetworkAndTXIDVersion[
          networkName
        ]?.[txidVersion]
      ) {
        ListProviderPOIEventQueue.setAddingPOIEventKey(
          networkName,
          txidVersion,
          undefined, // key
        );
      }
    }
  }
}
