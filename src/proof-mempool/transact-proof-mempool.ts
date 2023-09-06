import { NetworkName } from '@railgun-community/shared-models';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { TransactProofData } from '../models/proof-types';
import { groth16 } from 'snarkjs';
import TransactProofVkey from './json/transact-proof-vkey.json';
import { POIHistoricalMerklerootDatabase } from '../database/databases/poi-historical-merkleroot-database';
import { TransactProofMempoolCache } from './transact-proof-mempool-cache';

export class TransactProofMempool {
  static async addProof(
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
    const verifiedProof = await this.verifySnarkProof(transactProofData);
    if (!verifiedProof) {
      return false;
    }

    return true;
  }

  private static async verifySnarkProof(
    transactProofData: TransactProofData,
  ): Promise<boolean> {
    const publicSignals: string[] = [];

    return groth16.verify(
      TransactProofVkey,
      publicSignals,
      transactProofData.snarkProof,
    );
  }
}
