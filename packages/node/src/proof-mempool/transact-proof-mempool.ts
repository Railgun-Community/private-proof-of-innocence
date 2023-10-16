import {
  NetworkName,
  TXIDVersion,
  TransactProofData,
  isDefined,
} from '@railgun-community/shared-models';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { POIHistoricalMerklerootDatabase } from '../database/databases/poi-historical-merkleroot-database';
import { TransactProofMempoolCache } from './transact-proof-mempool-cache';
import { verifyTransactProof } from '../util/snark-proof-verify';
import { POINodeCountingBloomFilter } from '../util/poi-node-bloom-filters';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { QueryLimits } from '../config/query-limits';
import { ListProviderPOIEventQueue } from '../list-provider/list-provider-poi-event-queue';
import { Config } from '../config/config';
import { networkForName, nodeURLForListKey } from '../config/general';
import { hexToBigInt } from '@railgun-community/wallet';
import { POINodeRequest } from '../api/poi-node-request';
import debug from 'debug';
import { PushSync } from '../sync/push-sync';
import { TransactProofMempoolPruner } from './transact-proof-mempool-pruner';
import { tryValidateRailgunTxidOccurredBeforeBlockNumber } from '../engine/wallet';

const dbg = debug('poi:transact-proof-mempool');

const VALIDATION_ERROR_TEXT = 'Validation error';

export class TransactProofMempool {
  static async submitProof(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ) {
    const shouldAdd = await this.shouldAdd(
      listKey,
      networkName,
      txidVersion,
      transactProofData,
    );
    if (!shouldAdd) {
      return;
    }

    const firstBlindedCommitment =
      this.getTransactFirstBlindedCommitment(transactProofData);

    const db = new TransactProofPerListMempoolDatabase(
      networkName,
      txidVersion,
    );
    await db.insertTransactProof(
      listKey,
      transactProofData,
      firstBlindedCommitment,
    );

    TransactProofMempoolCache.addToCache(
      listKey,
      networkName,
      txidVersion,
      transactProofData,
      firstBlindedCommitment,
    );

    await TransactProofMempool.tryAddToList(
      listKey,
      networkName,
      txidVersion,
      transactProofData,
    );
  }

  private static async pushProofToDestinationNode(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ): Promise<boolean> {
    const nodeURL = nodeURLForListKey(listKey);
    if (!isDefined(nodeURL)) {
      return false;
    }
    try {
      await PushSync.sendNodeRequest(
        nodeURL,
        async nodeURL => {
          await POINodeRequest.submitTransactProof(
            nodeURL,
            networkName,
            txidVersion,
            listKey,
            transactProofData,
          );
        },
        true, // shouldThrow
      );
      return true;
    } catch (err) {
      dbg(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Error submitting transact proof to destination node: ${err.message}`,
      );
      if (!(err instanceof Error)) {
        return false;
      }
      if (err.message.includes(VALIDATION_ERROR_TEXT)) {
        // This will throw error for the client, when submitting proof.
        throw err;
      }
      return false;
    }
  }

  static async tryAddToList(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ): Promise<void> {
    if (ListProviderPOIEventQueue.listKey !== listKey) {
      // Immediately push to destination node, by its listKey
      await this.pushProofToDestinationNode(
        listKey,
        networkName,
        txidVersion,
        transactProofData,
      );
    }

    const { tree, index } =
      RailgunTxidMerkletreeManager.getTreeAndIndexFromTxidIndex(
        transactProofData.txidMerklerootIndex,
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

    dbg(
      isLegacyTransaction
        ? 'Adding transact proof (LEGACY)...'
        : 'Adding transact proof...',
    );

    if (!isLegacyTransaction) {
      // Verify all POI Merkleroots exist
      const poiMerklerootDb = new POIHistoricalMerklerootDatabase(
        networkName,
        txidVersion,
      );
      const allPOIMerklerootsExist = await poiMerklerootDb.allMerklerootsExist(
        listKey,
        transactProofData.poiMerkleroots,
      );
      if (!allPOIMerklerootsExist) {
        dbg(
          `Cannot add proof - POI merkleroots must all exist. Is this a legacy transaction? ${networkName} TXID tree:index ${tree}:${index}.`,
        );
        dbg(transactProofData);
        await this.removeProof(
          listKey,
          networkName,
          txidVersion,
          transactProofData,
        );
        throw new Error(
          `${VALIDATION_ERROR_TEXT}: POI merkleroots must all exist.`,
        );
      }
    }

    // Verify historical Railgun Txid Merkleroot exists
    const isValidTxidMerkleroot =
      await RailgunTxidMerkletreeManager.checkIfMerklerootExistsByTxidIndex(
        networkName,
        txidVersion,
        transactProofData.txidMerklerootIndex,
        transactProofData.txidMerkleroot,
      );
    if (!isValidTxidMerkleroot) {
      dbg('Cannot add proof - Invalid txid merkleroot');
      dbg(transactProofData);
      await this.removeProof(
        listKey,
        networkName,
        txidVersion,
        transactProofData,
      );
      throw new Error(`${VALIDATION_ERROR_TEXT}: Invalid txid merkleroot.`);
    }

    ListProviderPOIEventQueue.queueUnsignedPOITransactEvent(
      networkName,
      txidVersion,
      transactProofData,
    );
  }

  static async removeProof(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ) {
    const firstBlindedCommitment =
      TransactProofMempool.getTransactFirstBlindedCommitment(transactProofData);

    await TransactProofMempoolPruner.removeProof(
      listKey,
      networkName,
      txidVersion,
      firstBlindedCommitment,
    );

    await PushSync.sendNodeRequestToAllNodes(async nodeURL => {
      await POINodeRequest.removeTransactProof(
        nodeURL,
        networkName,
        txidVersion,
        listKey,
        firstBlindedCommitment,
      );
    });
  }

  private static async shouldAdd(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ): Promise<boolean> {
    // 1. Verify that doesn't already exist
    const db = new TransactProofPerListMempoolDatabase(
      networkName,
      txidVersion,
    );
    const firstBlindedCommitment =
      this.getTransactFirstBlindedCommitment(transactProofData);
    const exists = await db.proofExists(listKey, firstBlindedCommitment);
    if (exists) {
      dbg(
        `Proof already exists for first blinded commitment: ${firstBlindedCommitment}`,
      );
      return false;
    }

    // 2. Verify that OrderedEvent for this list doesn't exist.
    const orderedEventsExist =
      await this.hasOrderedEventForEveryBlindedCommitment(
        listKey,
        networkName,
        txidVersion,
        transactProofData,
      );
    if (orderedEventsExist) {
      dbg('Event already exists for every blinded commitment');
      return false;
    }

    // 3. Verify snark proof
    const verifiedProof = await verifyTransactProof(transactProofData);
    if (!verifiedProof) {
      dbg('Invalid snark proof');
      throw new Error('Invalid proof');
    }

    return true;
  }

  static getTransactFirstBlindedCommitment(
    transactProofData: TransactProofData,
  ) {
    for (const blindedCommitment of transactProofData.blindedCommitmentsOut) {
      if (hexToBigInt(blindedCommitment) !== 0n) {
        return blindedCommitment;
      }
    }
    if (hexToBigInt(transactProofData.railgunTxidIfHasUnshield) === 0n) {
      throw new Error('Must have at least one commitment, including unshield');
    }
    return transactProofData.railgunTxidIfHasUnshield;
  }

  private static async hasOrderedEventForEveryBlindedCommitment(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ): Promise<boolean> {
    const blindedCommitmentsOut =
      transactProofData.blindedCommitmentsOut.filter(blindedCommitment => {
        return hexToBigInt(blindedCommitment) !== 0n;
      });
    if (hexToBigInt(transactProofData.railgunTxidIfHasUnshield) !== 0n) {
      blindedCommitmentsOut.push(transactProofData.railgunTxidIfHasUnshield);
    }

    const orderedEventsDB = new POIOrderedEventsDatabase(
      networkName,
      txidVersion,
    );

    const existingEvents: string[] = [];

    for (const blindedCommitment of blindedCommitmentsOut) {
      const orderedEventExists = await orderedEventsDB.eventExists(
        listKey,
        blindedCommitment,
      );
      if (orderedEventExists) {
        existingEvents.push(blindedCommitment);
      }
    }

    if (
      existingEvents.length > 0 &&
      existingEvents.length < blindedCommitmentsOut.length
    ) {
      dbg(
        `DANGER: some transact events (${
          existingEvents.length
        }) already exist for ${existingEvents.join(
          ', ',
        )}, but not for all blinded commitments (${
          blindedCommitmentsOut.length
        }): ${blindedCommitmentsOut.join(', ')}`,
      );
    }

    return existingEvents.length === blindedCommitmentsOut.length;
  }

  static async inflateCacheFromDatabase(listKeys: string[]) {
    for (const networkName of Config.NETWORK_NAMES) {
      for (const txidVersion of Config.TXID_VERSIONS) {
        const db = new TransactProofPerListMempoolDatabase(
          networkName,
          txidVersion,
        );

        for (const listKey of listKeys) {
          const transactProofsStream = await db.streamTransactProofs(listKey);

          for await (const transactProofDBItem of transactProofsStream) {
            const transactProofData: TransactProofData = {
              snarkProof: transactProofDBItem.snarkProof,
              poiMerkleroots: transactProofDBItem.poiMerkleroots,
              txidMerkleroot: transactProofDBItem.txidMerkleroot,
              txidMerklerootIndex: transactProofDBItem.txidMerklerootIndex,
              blindedCommitmentsOut: transactProofDBItem.blindedCommitmentsOut,
              railgunTxidIfHasUnshield:
                transactProofDBItem.railgunTxidIfHasUnshield,
            };
            const orderedEventsExist =
              await this.hasOrderedEventForEveryBlindedCommitment(
                listKey,
                networkName,
                txidVersion,
                transactProofData,
              );
            const firstBlindedCommitment =
              this.getTransactFirstBlindedCommitment(transactProofData);
            if (orderedEventsExist) {
              // Remove item from the database.
              await TransactProofMempoolPruner.removeProof(
                listKey,
                networkName,
                txidVersion,
                firstBlindedCommitment,
              );
              return;
            }
            TransactProofMempoolCache.addToCache(
              listKey,
              networkName,
              txidVersion,
              transactProofData,
              firstBlindedCommitment,
            );
          }
        }
      }
    }
  }

  static getFilteredProofs(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    countingBloomFilterSerialized: string,
  ): TransactProofData[] {
    const transactProofDatas: TransactProofData[] =
      TransactProofMempoolCache.getTransactProofs(
        listKey,
        networkName,
        txidVersion,
      );

    const bloomFilter = POINodeCountingBloomFilter.deserialize(
      countingBloomFilterSerialized,
    );

    const filteredProofs: TransactProofData[] = transactProofDatas.filter(
      transactProofData => {
        const firstBlindedCommitment =
          this.getTransactFirstBlindedCommitment(transactProofData);
        return !bloomFilter.has(firstBlindedCommitment);
      },
    );
    return filteredProofs.slice(0, QueryLimits.PROOF_MEMPOOL_SYNCED_ITEMS);
  }
}
