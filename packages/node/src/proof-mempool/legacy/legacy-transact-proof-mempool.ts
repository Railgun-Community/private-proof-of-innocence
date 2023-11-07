import {
  NetworkName,
  TXIDVersion,
  LegacyTransactProofData,
  isDefined,
} from '@railgun-community/shared-models';
import { POINodeCountingBloomFilter } from '../../util/poi-node-bloom-filters';
import { POIOrderedEventsDatabase } from '../../database/databases/poi-ordered-events-database';
import { RailgunTxidMerkletreeManager } from '../../railgun-txids/railgun-txid-merkletree-manager';
import { QueryLimits } from '../../config/query-limits';
import { ListProviderPOIEventQueue } from '../../list-provider/list-provider-poi-event-queue';
import { Config } from '../../config/config';
import { networkForName, nodeURLForListKey } from '../../config/general';
import { POINodeRequest } from '../../api/poi-node-request';
import debug from 'debug';
import { PushSync } from '../../sync/push-sync';
import {
  tryGetGlobalUTXOTreePositionForRailgunTransactionCommitment,
  tryValidateRailgunTxidOccurredBeforeBlockNumber,
} from '../../engine/wallet';
import { LegacyTransactProofMempoolDatabase } from '../../database/databases/legacy-transact-proof-mempool-database';
import { LegacyTransactProofMempoolCache } from './legacy-transact-proof-mempool-cache';
import {
  ByteLength,
  TransactNote,
  getBlindedCommitmentForShieldOrTransact,
  nToHex,
} from '@railgun-community/wallet';
import { POIOrderedEventDBItem } from '../../models/database-types';

const dbg = debug('poi:transact-proof-mempool');

const VALIDATION_ERROR_TEXT = 'Validation error';

export class LegacyTransactProofMempool {
  static async submitLegacyProof(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    legacyTransactProofData: LegacyTransactProofData,
    listKeysForPush: string[],
  ) {
    const shouldAdd = await this.shouldAdd(
      networkName,
      txidVersion,
      legacyTransactProofData,
    );
    if (!shouldAdd) {
      return;
    }

    const db = new LegacyTransactProofMempoolDatabase(networkName, txidVersion);
    await db.insertLegacyTransactProof(legacyTransactProofData);

    LegacyTransactProofMempoolCache.addToCache(
      networkName,
      txidVersion,
      legacyTransactProofData,
    );

    await LegacyTransactProofMempool.tryAddToList(
      networkName,
      txidVersion,
      legacyTransactProofData,
    );

    await this.pushProofToDestinationNodes(
      listKeysForPush,
      networkName,
      txidVersion,
      legacyTransactProofData,
    );
  }

  private static async pushProofToDestinationNodes(
    listKeys: string[],
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    legacyTransactProofData: LegacyTransactProofData,
  ) {
    listKeys.forEach(async listKey => {
      const nodeURL = nodeURLForListKey(listKey);
      if (!isDefined(nodeURL)) {
        return;
      }
      try {
        await PushSync.sendNodeRequest(
          nodeURL,
          async nodeURL => {
            await POINodeRequest.submitLegacyTransactProof(
              nodeURL,
              networkName,
              txidVersion,
              legacyTransactProofData,
            );
          },
          true, // shouldThrow
        );
      } catch (err) {
        dbg(err);
        if (!(err instanceof Error)) {
          return;
        }
        if (err.message.includes(VALIDATION_ERROR_TEXT)) {
          // This will throw error for the client, when submitting proof.
          throw err;
        }
      }
    });
  }

  private static async tryAddToList(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    legacyTransactProofData: LegacyTransactProofData,
  ) {
    const listKey = ListProviderPOIEventQueue.listKey;
    if (!listKey) {
      return;
    }

    // Verify that OrderedEvent for this list doesn't exist.
    const orderedEvent = await this.getOrderedEventForBlindedCommitment(
      networkName,
      txidVersion,
      legacyTransactProofData.blindedCommitment,
    );
    if (orderedEvent) {
      dbg('Legacy transact event already exists for blinded commitment:');
      dbg(orderedEvent);
      return;
    }

    const isLegacyTransaction = await this.isLegacyTransaction(
      networkName,
      txidVersion,
      legacyTransactProofData,
    );
    if (!isLegacyTransaction) {
      dbg(`${VALIDATION_ERROR_TEXT}: Not a legacy transaction`);
      return;
    }

    dbg('Adding legacy transact event');

    ListProviderPOIEventQueue.queueUnsignedPOILegacyTransactEvent(
      listKey,
      networkName,
      txidVersion,
      legacyTransactProofData,
    );
  }

  private static async isLegacyTransaction(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    legacyTransactProofData: LegacyTransactProofData,
  ): Promise<boolean> {
    const { tree, index } =
      RailgunTxidMerkletreeManager.getTreeAndIndexFromTxidIndex(
        Number(legacyTransactProofData.txidIndex),
      );

    const networkPOISettings = networkForName(networkName).poi;

    const isLegacyTransaction = isDefined(networkPOISettings)
      ? await tryValidateRailgunTxidOccurredBeforeBlockNumber(
          txidVersion,
          networkName,
          tree,
          index,
          networkPOISettings.launchBlock,
        )
      : false;
    return isLegacyTransaction;
  }

  static async verifyBlindedCommitment(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    legacyTransactProofData: LegacyTransactProofData,
  ): Promise<boolean> {
    try {
      const { tree, index } =
        RailgunTxidMerkletreeManager.getTreeAndIndexFromTxidIndex(
          Number(legacyTransactProofData.txidIndex),
        );

      const commitmentHash = this.getCommitmentHash(
        legacyTransactProofData.npk,
        legacyTransactProofData.tokenHash,
        legacyTransactProofData.value,
      );

      const utxoGlobalPosition =
        await tryGetGlobalUTXOTreePositionForRailgunTransactionCommitment(
          txidVersion,
          networkName,
          tree,
          index,
          commitmentHash,
        );

      const blindedCommitment = getBlindedCommitmentForShieldOrTransact(
        commitmentHash,
        BigInt(legacyTransactProofData.npk),
        BigInt(utxoGlobalPosition),
      );
      if (blindedCommitment !== legacyTransactProofData.blindedCommitment) {
        throw new Error('Invalid blinded commitment');
      }

      return true;
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(`Could not validate transaction - ${err.message}`);
      return false;
    }
  }

  private static getCommitmentHash(
    notePublicKey: string,
    tokenHash: string,
    value: string,
  ): string {
    return nToHex(
      TransactNote.getHash(BigInt(notePublicKey), tokenHash, BigInt(value)),
      ByteLength.UINT_256,
    );
  }

  private static async shouldAdd(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    legacyTransactProofData: LegacyTransactProofData,
  ): Promise<boolean> {
    // 1. Verify that legacy proof doesn't already exist
    const db = new LegacyTransactProofMempoolDatabase(networkName, txidVersion);
    const { blindedCommitment } = legacyTransactProofData;

    const exists = await db.legacyProofExists(blindedCommitment);
    if (exists) {
      dbg('Proof already exists for legacy blinded commitment');
      return false;
    }

    // 2. Verify that it is a legacy transaction
    const isLegacyTransaction = await this.isLegacyTransaction(
      networkName,
      txidVersion,
      legacyTransactProofData,
    );
    if (!isLegacyTransaction) {
      dbg('Not a legacy transaction');
      return false;
    }

    // 3. Calculate and verify blinded commitment
    const verified = await this.verifyBlindedCommitment(
      networkName,
      txidVersion,
      legacyTransactProofData,
    );
    if (!verified) {
      dbg('Could not verify blinded commitment');
      return false;
    }

    return true;
  }

  private static async getOrderedEventForBlindedCommitment(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitment: string,
  ): Promise<Optional<POIOrderedEventDBItem>> {
    if (!ListProviderPOIEventQueue.listKey) {
      return;
    }
    const orderedEventsDB = new POIOrderedEventsDatabase(
      networkName,
      txidVersion,
    );
    return orderedEventsDB.getEvent(
      ListProviderPOIEventQueue.listKey,
      blindedCommitment,
    );
  }

  static async inflateCacheFromDatabase() {
    for (const networkName of Config.NETWORK_NAMES) {
      for (const txidVersion of Config.TXID_VERSIONS) {
        const db = new LegacyTransactProofMempoolDatabase(
          networkName,
          txidVersion,
        );

        const legacyTransactProofsStream =
          await db.streamLegacyTransactProofs();

        for await (const legacyTransactProofDBItem of legacyTransactProofsStream) {
          const legacyTransactProofData: LegacyTransactProofData = {
            txidIndex: legacyTransactProofDBItem.txidIndex,
            npk: legacyTransactProofDBItem.npk,
            value: legacyTransactProofDBItem.value,
            tokenHash: legacyTransactProofDBItem.tokenHash,
            blindedCommitment: legacyTransactProofDBItem.blindedCommitment,
          };
          if (ListProviderPOIEventQueue.listKey) {
            const existingEvent =
              await this.getOrderedEventForBlindedCommitment(
                networkName,
                txidVersion,
                legacyTransactProofData.blindedCommitment,
              );
            if (!existingEvent) {
              await LegacyTransactProofMempool.tryAddToList(
                networkName,
                txidVersion,
                legacyTransactProofData,
              );
            }
          }
          LegacyTransactProofMempoolCache.addToCache(
            networkName,
            txidVersion,
            legacyTransactProofData,
          );
        }
      }
    }
  }

  static getFilteredProofs(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    countingBloomFilterSerialized: string,
  ): LegacyTransactProofData[] {
    const legacyTransactProofDatas: LegacyTransactProofData[] =
      LegacyTransactProofMempoolCache.getLegacyTransactProofs(
        networkName,
        txidVersion,
      );

    const bloomFilter = POINodeCountingBloomFilter.deserialize(
      countingBloomFilterSerialized,
    );

    const filteredProofs: LegacyTransactProofData[] =
      legacyTransactProofDatas.filter(legacyTransactProofData => {
        return !bloomFilter.has(legacyTransactProofData.blindedCommitment);
      });
    return filteredProofs.slice(0, QueryLimits.PROOF_MEMPOOL_SYNCED_ITEMS);
  }

  static getLegacyTransactProofsCount(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ) {
    return LegacyTransactProofMempoolCache.getCacheSize(
      networkName,
      txidVersion,
    );
  }
}
