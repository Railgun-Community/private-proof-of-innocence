import { NetworkName } from '@railgun-community/shared-models';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { TransactProofData } from '../models/proof-types';
import TransactProofVkey from './json/transact-proof-vkey.json';
import { POIHistoricalMerklerootDatabase } from '../database/databases/poi-historical-merkleroot-database';
import { TransactProofMempoolCache } from './transact-proof-mempool-cache';
import { verifySnarkProof } from './snark-proof-verify';
import { ProofMempoolCountingBloomFilter } from './proof-mempool-bloom-filters';

export class TransactProofMempool {
  static async submitProof(
    listKey: string,
    networkName: NetworkName,
    transactProofData: TransactProofData,
  ) {
    const verified = await this.verify(listKey, networkName, transactProofData);
    if (!verified) {
      throw new Error('Invalid proof');
    }

    const db = new TransactProofPerListMempoolDatabase(networkName);
    await db.insertValidTransactProof(listKey, transactProofData);

    TransactProofMempoolCache.addToCache(
      listKey,
      networkName,
      transactProofData,
    );
  }

  private static async verify(
    listKey: string,
    networkName: NetworkName,
    transactProofData: TransactProofData,
  ): Promise<boolean> {
    // 1. Verify all POI Merkleroots exist
    const poiMerklerootDb = new POIHistoricalMerklerootDatabase(networkName);
    const allMerklerootsExist = await poiMerklerootDb.allMerklerootsExist(
      listKey,
      transactProofData.publicInputs.poiMerkleroots,
    );
    if (!allMerklerootsExist) {
      return false;
    }

    // 2. Verify Railgun TX Merkleroot exists against Railgun TX Merkletree (Engine)
    // TODO-HIGH-PRI

    // 3. Verify snark proof
    const verifiedProof = await this.verifyProof(transactProofData);
    if (!verifiedProof) {
      return false;
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
        const blindedCommitmentFirstInput =
          transactProofData.publicInputs.blindedCommitmentInputs[0];
        return !bloomFilter.has(blindedCommitmentFirstInput);
      },
    );
    return filteredProofs;
  }
}
