import { NetworkName, isDefined , ShieldProofData } from '@railgun-community/shared-models';
import ShieldProofVkey from './json/shield-proof-vkey.json';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { ShieldProofMempoolDatabase } from '../database/databases/shield-proof-mempool-database';
import { ShieldProofMempoolCache } from './shield-proof-mempool-cache';
import { verifySnarkProof } from './snark-proof-verify';
import { ProofMempoolBloomFilter } from './proof-mempool-bloom-filters';
import { QueryLimits } from '../config/query-limits';
import { ListProviderPOIEventQueue } from '../list-provider/list-provider-poi-event-queue';
import { ShieldStatus } from '../models/database-types';

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
    await shieldProofMempoolDB.insertShieldProof(shieldProofData);

    ShieldProofMempoolCache.addToCache(networkName, shieldProofData);

    await ShieldProofMempool.tryAddToActiveList(networkName, shieldProofData);
  }

  private static async tryAddToActiveList(
    networkName: NetworkName,
    shieldProofData: ShieldProofData,
  ) {
    if (!isDefined(ListProviderPOIEventQueue.listKey)) {
      return;
    }
    const shieldQueueDB = new ShieldQueueDatabase(networkName);
    const allowedShieldExists = await shieldQueueDB.commitmentHashExists(
      shieldProofData.commitmentHash,
      ShieldStatus.Allowed,
    );
    if (!allowedShieldExists) {
      return;
    }

    ListProviderPOIEventQueue.queueUnsignedPOIShieldEvent(
      networkName,
      shieldProofData,
    );
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

    // 2. Verify snark proof
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

      const shieldProofStream = await db.streamShieldProofs();

      for await (const shieldProofDBItem of shieldProofStream) {
        const shieldProofData: ShieldProofData = {
          snarkProof: shieldProofDBItem.snarkProof,
          commitmentHash: shieldProofDBItem.commitmentHash,
          blindedCommitment: shieldProofDBItem.blindedCommitment,
        };
        ShieldProofMempoolCache.addToCache(networkName, shieldProofData);
      }
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

  static async getFilteredProofs(
    networkName: NetworkName,
    bloomFilterSerialized: string,
  ): Promise<ShieldProofData[]> {
    const bloomFilter = ProofMempoolBloomFilter.deserialize(
      bloomFilterSerialized,
    );

    const db = new ShieldProofMempoolDatabase(networkName);
    const shieldProofStream = await db.streamShieldProofs();

    const filteredShieldProofs: ShieldProofData[] = [];

    for await (const shieldProofDBItem of shieldProofStream) {
      if (!bloomFilter.has(shieldProofDBItem.commitmentHash)) {
        filteredShieldProofs.push({
          snarkProof: shieldProofDBItem.snarkProof,
          commitmentHash: shieldProofDBItem.commitmentHash,
          blindedCommitment: shieldProofDBItem.blindedCommitment,
        });
      }
      if (
        filteredShieldProofs.length >= QueryLimits.PROOF_MEMPOOL_SYNCED_ITEMS
      ) {
        break;
      }
    }

    return filteredShieldProofs;
  }
}
