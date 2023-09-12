import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
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
    return this.insertOne(shieldProofData);
  }

  async proofExists(commitmentHash: string): Promise<boolean> {
    const filter: DBFilter<ShieldProofMempoolDBItem> = {
      commitmentHash,
    };
    return this.exists(filter);
  }

  async getAllShieldProofs(): Promise<ShieldProofData[]> {
    // TODO: Add a filter based on createdAt?
    const shieldProofDBDatas = await this.findAll();

    return shieldProofDBDatas.map((shieldProofDBData) => ({
      snarkProof: shieldProofDBData.snarkProof,
      commitmentHash: shieldProofDBData.commitmentHash,
      blindedCommitment: shieldProofDBData.blindedCommitment,
    }));
  }

  async getShieldProof(commitmentHash: string): Promise<Optional<ShieldProofMempoolDBItem>> {
    return this.findOne({ commitmentHash });
  }

  // TODO should we be able to delete items from the mempool?
}
