import { NetworkName } from '@railgun-community/shared-models';
import { ShieldProofData } from '../models/proof-types';
import ShieldProofVkey from './json/shield-proof-vkey.json';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { ShieldProofMempoolDatabase } from '../database/databases/shield-proof-mempool-database';
import { ShieldProofMempoolCache } from './shield-proof-mempool-cache';
import { verifySnarkProof } from './snark-proof-verify';
import { ProofMempoolBloomFilter } from './proof-mempool-bloom-filters';
import { QueryLimits } from '../config/query-limits';

export class ShieldProofMempool {
  static async submitProof(
    networkName: NetworkName,
    shieldProofData: ShieldProofData,
  ) {
    const shouldAdd = await this.shouldAdd(networkName, shieldProofData);
    if (!shouldAdd) {
      return;
    }

    const shieldProofMempoolDB = new ShieldProofMempoolDatabase(networkName);
    await shieldProofMempoolDB.insertValidShieldProof(shieldProofData);

    ShieldProofMempoolCache.addToCache(networkName, shieldProofData);
  }

  private static async shouldAdd(
    networkName: NetworkName,
    shieldProofData: ShieldProofData,
  ): Promise<boolean> {
    // 1. Verify that doesn't already exist
    const shieldProofMempoolDB = new ShieldProofMempoolDatabase(networkName);
    const exists = await shieldProofMempoolDB.proofExists(
      shieldProofData.commitmentHash,
    );
    if (exists) {
      return false;
    }

    // 2. Verify if shield commitmentHash is in historical list of Shields
    const shieldQueueDB = new ShieldQueueDatabase(networkName);
    const shieldExists = await shieldQueueDB.commitmentHashExists(
      shieldProofData.commitmentHash,
    );
    if (!shieldExists) {
      return false;
    }

    // 3. Verify snark proof
    const verifiedProof = await this.verifyProof(shieldProofData);
    if (!verifiedProof) {
      throw new Error('Invalid proof');
    }

    return true;
  }

  private static async verifyProof(
    shieldProofData: ShieldProofData,
  ): Promise<boolean> {
    // TODO-HIGH-PRI
    const publicSignals: string[] = [];

    return verifySnarkProof(
      ShieldProofVkey,
      publicSignals,
      shieldProofData.snarkProof,
    );
  }

  static async inflateCacheFromDatabase() {
    const networkNames = Object.values(NetworkName);
    for (const networkName of networkNames) {
      const db = new ShieldProofMempoolDatabase(networkName);
      const shieldProofDatas: ShieldProofData[] = await db.getAllShieldProofs();
      shieldProofDatas.forEach((shieldProofData) => {
        ShieldProofMempoolCache.addToCache(networkName, shieldProofData);
      });
    }
  }

  static async getShieldProofDataForCommitmentHash(
    networkName: NetworkName,
    commitmentHash: string,
  ): Promise<Optional<ShieldProofData>> {
    const includesCommitmentHash =
      ShieldProofMempoolCache.bloomFilterIncludesCommitmentHash(
        networkName,
        commitmentHash,
      );
    if (includesCommitmentHash) {
      return;
    }
    const db = new ShieldProofMempoolDatabase(networkName);
    return db.getShieldProof(commitmentHash);
  }

  static getFilteredProofs(
    networkName: NetworkName,
    bloomFilterSerialized: string,
  ): ShieldProofData[] {
    const shieldProofDatas: ShieldProofData[] =
      ShieldProofMempoolCache.getShieldProofs(networkName);

    const bloomFilter = ProofMempoolBloomFilter.deserialize(
      bloomFilterSerialized,
    );
    const filteredProofs: ShieldProofData[] = shieldProofDatas.filter(
      (shieldProofData) => {
        return !bloomFilter.has(shieldProofData.commitmentHash);
      },
    );
    return filteredProofs.slice(0, QueryLimits.PROOF_MEMPOOL_SYNCED_ITEMS);
  }
}
