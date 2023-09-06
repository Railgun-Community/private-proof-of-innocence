import { NetworkName } from '@railgun-community/shared-models';
import { ShieldProofData } from '../models/proof-types';
import { groth16 } from 'snarkjs';
import ShieldProofVkey from './json/shield-proof-vkey.json';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { ShieldProofMempoolDatabase } from '../database/databases/shield-proof-mempool-database';
import { ShieldProofMempoolCache } from './shield-proof-mempool-cache';

export class ShieldProofMempool {
  static async submitProof(
    networkName: NetworkName,
    shieldProofData: ShieldProofData,
  ) {
    const verified = await this.verify(networkName, shieldProofData);
    if (!verified) {
      throw new Error('Invalid proof');
    }

    const db = new ShieldProofMempoolDatabase(networkName);
    await db.insertValidShieldProof(shieldProofData);

    ShieldProofMempoolCache.addToCache(networkName, shieldProofData);
  }

  private static async verify(
    networkName: NetworkName,
    shieldProofData: ShieldProofData,
  ): Promise<boolean> {
    // 1. Verify if shield commitmentHash is in historical list of Shields
    const db = new ShieldQueueDatabase(networkName);
    const shieldExists = await db.commitmentHashExists(
      shieldProofData.publicInputs.commitmentHash,
    );
    if (!shieldExists) {
      return false;
    }

    // 2. Verify snark proof
    const verifiedProof = await this.verifySnarkProof(shieldProofData);
    if (!verifiedProof) {
      return false;
    }

    return true;
  }

  private static async verifySnarkProof(
    shieldProofData: ShieldProofData,
  ): Promise<boolean> {
    const publicSignals: string[] = [];

    return groth16.verify(
      ShieldProofVkey,
      publicSignals,
      shieldProofData.snarkProof,
    );
  }
}
