import {
  NetworkName,
  TXIDVersion,
  TransactProofData,
  isDefined,
} from '@railgun-community/shared-models';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { TransactProofMempoolCache } from './transact-proof-mempool-cache';
import { verifyTransactProof } from '../util/snark-proof-verify';
import { POINodeCountingBloomFilter } from '../util/poi-node-bloom-filters';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { QueryLimits } from '../config/query-limits';
import { ListProviderPOIEventQueue } from '../list-provider/list-provider-poi-event-queue';
import { Config } from '../config/config';
import { networkForName, nodeURLForListKey } from '../config/general';
import { POINodeRequest } from '../api/poi-node-request';
import debug from 'debug';
import { PushSync } from '../sync/push-sync';
import { TransactProofMempoolPruner } from './transact-proof-mempool-pruner';
import { tryValidateRailgunTxidOccurredBeforeBlockNumber } from '../engine/wallet';
import { TransactProofEventMatcher } from './transact-proof-event-matcher';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';
import { sha256Hash } from '../util/hash';

const dbg = debug('poi:transact-proof-mempool');

const VALIDATION_ERROR_TEXT = 'Validation error';

export class TransactProofMempool {
  private static doNotAddProofCache = new Map<string, boolean>();
  private static alreadyForwardedProofCache = new Map<string, boolean>();

  static async submitProof(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ) {
    const doNotAddProofCacheHash = sha256Hash({
      listKey,
      networkName,
      txidVersion,
      transactProofData,
    });
    if (this.doNotAddProofCache.has(doNotAddProofCacheHash)) {
      dbg('Do not add transact proof - cache hit');
      return;
    }

    const shouldAdd = await this.shouldAdd(
      listKey,
      networkName,
      txidVersion,
      transactProofData,
    );
    if (!shouldAdd) {
      this.doNotAddProofCache.set(doNotAddProofCacheHash, true);
      dbg('Do not add transact proof - shouldAdd is false');
      return;
    }

    const db = new TransactProofPerListMempoolDatabase(
      networkName,
      txidVersion,
    );
    await db.insertTransactProof(listKey, transactProofData);

    TransactProofMempoolCache.addToCache(
      listKey,
      networkName,
      txidVersion,
      transactProofData,
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
  ): Promise<void> {
    const nodeURL = nodeURLForListKey(listKey);
    if (!isDefined(nodeURL)) {
      return;
    }
    try {
      const cacheHash = sha256Hash({
        nodeURL,
        networkName,
        txidVersion,
        listKey,
        transactProofData,
      });
      if (this.alreadyForwardedProofCache.has(cacheHash)) {
        dbg('Already pushed proof to destination node');
        return;
      }

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

      // Cache sha hash of the transact proof contents, so that we don't push it again.
      this.alreadyForwardedProofCache.set(cacheHash, true);
    } catch (err) {
      dbg(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Error submitting transact proof to destination node: ${err.message}`,
      );
      if (!(err instanceof Error)) {
        return;
      }
      if (err.message.includes(VALIDATION_ERROR_TEXT)) {
        // This will throw error for the client, when submitting proof.
        throw err;
      }
    }
  }

  static async tryAddToList(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ): Promise<void> {
    if (ListProviderPOIEventQueue.listKey !== listKey) {
      await this.pushProofToDestinationNode(
        listKey,
        networkName,
        txidVersion,
        transactProofData,
      );
      return;
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
      const allPOIMerklerootsExist =
        await POIMerkletreeManager.validateAllPOIMerklerootsExist(
          txidVersion,
          networkName,
          listKey,
          transactProofData.poiMerkleroots,
        );
      if (!allPOIMerklerootsExist) {
        dbg(
          `Cannot add proof - POI merkleroots must all exist. Is this a legacy transaction? ${networkName} TXID tree:index ${tree}:${index}.`,
        );
        dbg(transactProofData);
        await TransactProofMempoolPruner.removeProof(
          listKey,
          networkName,
          txidVersion,
          transactProofData.blindedCommitmentsOut,
          transactProofData.railgunTxidIfHasUnshield,
          true, // shouldSendNodeRequest
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
      await TransactProofMempoolPruner.removeProof(
        listKey,
        networkName,
        txidVersion,
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
        true, // shouldSendNodeRequest
      );
      throw new Error(`${VALIDATION_ERROR_TEXT}: Invalid txid merkleroot.`);
    }

    ListProviderPOIEventQueue.queueUnsignedPOITransactEvent(
      listKey,
      networkName,
      txidVersion,
      transactProofData,
    );
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

    const exists = await db.proofExists(
      listKey,
      transactProofData.blindedCommitmentsOut,
      transactProofData.railgunTxidIfHasUnshield,
    );
    if (exists) {
      dbg(
        `Transact proof already exists for blinded commitments: ${transactProofData.blindedCommitmentsOut.join(
          ', ',
        )}`,
      );
      return false;
    }

    // 2. Verify that OrderedEvent for this list doesn't exist.
    const orderedEventsExist =
      await TransactProofEventMatcher.hasOrderedEventForEveryBlindedCommitment(
        listKey,
        networkName,
        txidVersion,
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
      );
    if (orderedEventsExist) {
      dbg('Event already exists for every blinded commitment');

      // Remove proof from mempool.
      await TransactProofMempoolPruner.removeProof(
        listKey,
        networkName,
        txidVersion,
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
        true, // shouldSendNodeRequest
      );
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
              await TransactProofEventMatcher.hasOrderedEventForEveryBlindedCommitment(
                listKey,
                networkName,
                txidVersion,
                transactProofData.blindedCommitmentsOut,
                transactProofData.railgunTxidIfHasUnshield,
              );
            if (orderedEventsExist) {
              // Remove item from the database.
              await TransactProofMempoolPruner.removeProof(
                listKey,
                networkName,
                txidVersion,
                transactProofData.blindedCommitmentsOut,
                transactProofData.railgunTxidIfHasUnshield,
                true, // shouldSendNodeRequest
              );
              return;
            }
            TransactProofMempoolCache.addToCache(
              listKey,
              networkName,
              txidVersion,
              transactProofData,
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
        return !bloomFilter.has(
          TransactProofMempoolCache.getBlindedCommitmentsCacheString(
            transactProofData.blindedCommitmentsOut,
            transactProofData.railgunTxidIfHasUnshield,
          ),
        );
      },
    );
    return filteredProofs.slice(0, QueryLimits.PROOF_MEMPOOL_SYNCED_ITEMS);
  }
}
