import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  ShieldProofMempoolDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';
import { ShieldProofData } from '../../models/proof-types';

export class ShieldProofMempoolDatabase extends AbstractDatabase<ShieldProofMempoolDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.ShieldProofMempool);
  }

  async createCollectionIndices() {
    await this.createIndex(['commitmentHash'], { unique: true });
  }

  async insertValidShieldProof(
    shieldProofData: ShieldProofData,
  ): Promise<void> {
    const { snarkProof, publicInputs } = shieldProofData;
    const { commitmentHash, blindedCommitment } = publicInputs;

    const item: ShieldProofMempoolDBItem = {
      snarkProof,
      commitmentHash,
      blindedCommitment,
    };
    return this.insertOne(item);
  }
}
