import { NetworkName } from '@railgun-community/shared-models';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { TransactProofData } from '../models/proof-types';
import TransactProofVkey from './json/transact-proof-vkey.json';
import { POIHistoricalMerklerootDatabase } from '../database/databases/poi-historical-merkleroot-database';
import { TransactProofMempoolCache } from './transact-proof-mempool-cache';
import { verifySnarkProof } from './snark-proof-verify';
import { ProofMempoolCountingBloomFilter } from './proof-mempool-bloom-filters';
import { POIOrderedEventsDatabase } from '../database/databases/poi-ordered-events-database';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';
import { QueryLimits } from '../config/query-limits';

export class TransactProofMempool {
  static async submitProof(
    listKey: string,
    networkName: NetworkName,
    transactProofData: TransactProofData,
  ) {
    if (transactProofData.blindedCommitmentInputs.length < 1) {
      throw new Error('Requires blindedCommitmentInputs');
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
    await db.insertValidTransactProof(listKey, transactProofData);

    TransactProofMempoolCache.addToCache(
      listKey,
      networkName,
      transactProofData,
    );
  }

  static async removeProof(
    listKey: string,
    networkName: NetworkName,
    firstBlindedCommitmentInput: string,
  ) {
    const db = new TransactProofPerListMempoolDatabase(networkName);
    await db.deleteProof(listKey, firstBlindedCommitmentInput);

    TransactProofMempoolCache.removeFromCache(
      listKey,
      networkName,
      firstBlindedCommitmentInput,
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
      transactProofData.blindedCommitmentInputs[0],
    );
    if (exists) {
      return false;
    }

    // 2. Verify all POI Merkleroots exist
    const poiMerklerootDb = new POIHistoricalMerklerootDatabase(networkName);
    const allMerklerootsExist = await poiMerklerootDb.allMerklerootsExist(
      listKey,
      transactProofData.poiMerkleroots,
    );
    if (!allMerklerootsExist) {
      return false;
    }

    // 3. Verify Railgun TX Merkleroot exists against Railgun TX Merkletree (Engine)
    const isValidTxMerkleroot =
      await RailgunTxidMerkletreeManager.checkIfMerklerootExistsByTxidIndex(
        networkName,
        transactProofData.txidIndex,
        transactProofData.txMerkleroot,
      );
    if (!isValidTxMerkleroot) {
      return false;
    }

    // 4. Verify that OrderedEvent for this list doesn't exist.
    const orderedEventsDB = new POIOrderedEventsDatabase(networkName);
    const orderedEventExists = await orderedEventsDB.eventExists(
      listKey,
      transactProofData.blindedCommitmentInputs[0],
    );
    if (orderedEventExists) {
      return false;
    }

    // 5. Verify snark proof
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
    const networkNames = Object.values(NetworkName);
    for (const networkName of networkNames) {
      const db = new TransactProofPerListMempoolDatabase(networkName);
      const transactProofsAndLists = await db.getAllTransactProofsAndLists();
      transactProofsAndLists.forEach(({ transactProofData, listKey }) => {
        TransactProofMempoolCache.addToCache(
          listKey,
          networkName,
          transactProofData,
        );
      });
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
        const firstBlindedCommitmentInput =
          transactProofData.blindedCommitmentInputs[0];
        return !bloomFilter.has(firstBlindedCommitmentInput);
      },
    );
    return filteredProofs.slice(0, QueryLimits.PROOF_MEMPOOL_SYNCED_ITEMS);
  }
}
