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
import { validateRailgunTxidOccurredBeforeBlockNumber } from '@railgun-community/wallet';
import { POINodeRequest } from '../api/poi-node-request';
import debug from 'debug';
import { PushSync } from '../sync/push-sync';
import { TransactProofMempoolPruner } from './transact-proof-mempool-pruner';

const dbg = debug('poi:transact-proof-mempool');

export class TransactProofMempool {
  static async submitProof(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ) {
    if (transactProofData.blindedCommitmentOutputs.length < 1) {
      throw new Error('Requires blindedCommitmentOutputs');
    }

    const shouldAdd = await this.shouldAdd(
      listKey,
      networkName,
      txidVersion,
      transactProofData,
    );
    if (!shouldAdd) {
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

    try {
      if (ListProviderPOIEventQueue.listKey === listKey) {
        await TransactProofMempool.tryAddToActiveList(
          listKey,
          networkName,
          txidVersion,
          transactProofData,
        );
      } else {
        // Immediately push to destination node, by its listKey
        const nodeURL = nodeURLForListKey(listKey);
        if (!isDefined(nodeURL)) {
          return;
        }
        await PushSync.sendNodeRequest(nodeURL, async nodeURL => {
          await POINodeRequest.submitTransactProof(
            nodeURL,
            networkName,
            txidVersion,
            listKey,
            transactProofData,
          );
        });
      }
    } catch (err) {
      dbg(err);
      return;
    }
  }

  static async tryAddToActiveList(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ) {
    const { tree, index } =
      RailgunTxidMerkletreeManager.getTreeAndIndexFromTxidIndex(
        transactProofData.txidMerklerootIndex,
      );

    const networkPOISettings = networkForName(networkName).poi;
    const isLegacyTransaction = isDefined(networkPOISettings)
      ? await validateRailgunTxidOccurredBeforeBlockNumber(
          txidVersion,
          networkName,
          tree,
          index,
          networkPOISettings.launchBlock,
        )
      : false;

    if (!isLegacyTransaction) {
      // Verify all POI Merkleroots exist
      const poiMerklerootDb = new POIHistoricalMerklerootDatabase(
        networkName,
        txidVersion,
      );
      const allMerklerootsExist = await poiMerklerootDb.allMerklerootsExist(
        listKey,
        transactProofData.poiMerkleroots,
      );
      if (!allMerklerootsExist) {
        return;
      }
    }

    // Verify historical Railgun Txid Merkleroot exists
    const isValidTxMerkleroot =
      await RailgunTxidMerkletreeManager.checkIfMerklerootExistsByTxidIndex(
        networkName,
        txidVersion,
        transactProofData.txidMerklerootIndex,
        transactProofData.txidMerkleroot,
      );
    if (!isValidTxMerkleroot) {
      return;
    }

    ListProviderPOIEventQueue.queueUnsignedPOITransactEvent(
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
      transactProofData.blindedCommitmentOutputs[0],
    );
    if (exists) {
      return false;
    }

    // 2. Verify that OrderedEvent for this list doesn't exist.
    const orderedEventExists =
      await this.hasOrderedEventForFirstBlindedCommitment(
        listKey,
        networkName,
        txidVersion,
        transactProofData.blindedCommitmentOutputs[0],
      );
    if (orderedEventExists) {
      return false;
    }

    // 3. Verify snark proof
    const verifiedProof = await verifyTransactProof(transactProofData);
    if (!verifiedProof) {
      throw new Error('Invalid proof');
    }

    return true;
  }

  private static async hasOrderedEventForFirstBlindedCommitment(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitment: string,
  ): Promise<boolean> {
    const orderedEventsDB = new POIOrderedEventsDatabase(
      networkName,
      txidVersion,
    );
    const orderedEventExists = await orderedEventsDB.eventExists(
      listKey,
      blindedCommitment,
    );
    return orderedEventExists;
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
              blindedCommitmentOutputs:
                transactProofDBItem.blindedCommitmentOutputs,
            };
            const firstBlindedCommitment =
              transactProofData.blindedCommitmentOutputs[0];
            const orderedEventExists =
              await this.hasOrderedEventForFirstBlindedCommitment(
                listKey,
                networkName,
                txidVersion,
                firstBlindedCommitment,
              );
            if (orderedEventExists) {
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
          transactProofData.blindedCommitmentOutputs[0];
        return !bloomFilter.has(firstBlindedCommitment);
      },
    );
    return filteredProofs.slice(0, QueryLimits.PROOF_MEMPOOL_SYNCED_ITEMS);
  }
}
