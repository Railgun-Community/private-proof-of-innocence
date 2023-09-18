import { NetworkName , TransactProofData } from '@railgun-community/shared-models';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import TransactProofVkey from './json/transact-proof-vkey.json';
import { POIHistoricalMerklerootDatabase } from '../database/databases/poi-historical-merkleroot-database';
import { TransactProofMempoolCache } from './transact-proof-mempool-cache';
import { verifySnarkProof } from './snark-proof-verify';
import { ProofMempoolCountingBloomFilter } from './proof-mempool-bloom-filters';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { QueryLimits } from '../config/query-limits';
import { ListProviderPOIEventQueue } from '../list-provider/list-provider-poi-event-queue';
import { Config } from '../config/config';

export class TransactProofMempool {
  static async submitProof(
    listKey: string,
    networkName: NetworkName,
    transactProofData: TransactProofData,
  ) {
    if (transactProofData.blindedCommitmentOutputs.length < 1) {
      throw new Error('Requires blindedCommitmentOutputs');
    }

    const shouldAdd = await this.shouldAdd(
      listKey,
      networkName,
      transactProofData,
    );
    if (!shouldAdd) {
      return;
    }

    const db = new TransactProofPerListMempoolDatabase(networkName);
    await db.insertTransactProof(listKey, transactProofData);

    TransactProofMempoolCache.addToCache(
      listKey,
      networkName,
      transactProofData,
    );

    await TransactProofMempool.tryAddToActiveList(
      listKey,
      networkName,
      transactProofData,
    );
  }

  static async tryAddToActiveList(
    listKey: string,
    networkName: NetworkName,
    transactProofData: TransactProofData,
  ) {
    if (ListProviderPOIEventQueue.listKey !== listKey) {
      return;
    }

    // Verify all POI Merkleroots exist
    const poiMerklerootDb = new POIHistoricalMerklerootDatabase(networkName);
    const allMerklerootsExist = await poiMerklerootDb.allMerklerootsExist(
      listKey,
      transactProofData.poiMerkleroots,
    );
    if (!allMerklerootsExist) {
      return;
    }

    // Verify Railgun TX Merkleroot exists against Railgun TX Merkletree (Engine)
    const isValidTxMerkleroot =
      await RailgunTxidMerkletreeManager.checkIfMerklerootExistsByTxidIndex(
        networkName,
        transactProofData.txidMerklerootIndex,
        transactProofData.txidMerkleroot,
      );
    if (!isValidTxMerkleroot) {
      return;
    }

    ListProviderPOIEventQueue.queueUnsignedPOITransactEvent(
      networkName,
      transactProofData,
    );
  }

  private static async shouldAdd(
    listKey: string,
    networkName: NetworkName,
    transactProofData: TransactProofData,
  ): Promise<boolean> {
    // 1. Verify that doesn't already exist
    const db = new TransactProofPerListMempoolDatabase(networkName);
    const exists = await db.proofExists(
      listKey,
      transactProofData.blindedCommitmentOutputs[0],
    );
    if (exists) {
      return false;
    }

    // 2. Verify that OrderedEvent for this list doesn't exist.
    const orderedEventsDB = new POIOrderedEventsDatabase(networkName);
    const orderedEventExists = await orderedEventsDB.eventExists(
      listKey,
      transactProofData.blindedCommitmentOutputs[0],
    );
    if (orderedEventExists) {
      return false;
    }

    // 3. Verify snark proof
    const verifiedProof = await this.verifyProof(transactProofData);
    if (!verifiedProof) {
      throw new Error('Invalid proof');
    }

    return true;
  }

  private static async verifyProof(
    transactProofData: TransactProofData,
  ): Promise<boolean> {
    // TODO-HIGH-PRI
    const publicSignals: string[] = [];

    return verifySnarkProof(
      TransactProofVkey,
      publicSignals,
      transactProofData.snarkProof,
    );
  }

  static async inflateCacheFromDatabase() {
    for (const networkName of Config.NETWORK_NAMES) {
      const db = new TransactProofPerListMempoolDatabase(networkName);

      for (const listKey of Config.LIST_KEYS) {
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
          TransactProofMempoolCache.addToCache(
            listKey,
            networkName,
            transactProofData,
          );
        }
      }
    }
  }

  static getFilteredProofs(
    listKey: string,
    networkName: NetworkName,
    countingBloomFilterSerialized: string,
  ): TransactProofData[] {
    const transactProofDatas: TransactProofData[] =
      TransactProofMempoolCache.getTransactProofs(listKey, networkName);

    const bloomFilter = ProofMempoolCountingBloomFilter.deserialize(
      countingBloomFilterSerialized,
    );

    const filteredProofs: TransactProofData[] = transactProofDatas.filter(
      (transactProofData) => {
        const firstBlindedCommitment =
          transactProofData.blindedCommitmentOutputs[0];
        return !bloomFilter.has(firstBlindedCommitment);
      },
    );
    return filteredProofs.slice(0, QueryLimits.PROOF_MEMPOOL_SYNCED_ITEMS);
  }
}
