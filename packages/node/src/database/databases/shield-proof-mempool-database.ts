import { NetworkName, ShieldProofData } from '@railgun-community/shared-models';
import {
  CollectionName,
  DBFilter,
  DBStream,
  ShieldProofMempoolDBItem,
} from '../../models/database-types';
import { AbstractDatabase } from '../abstract-database';

export class ShieldProofMempoolDatabase extends AbstractDatabase<ShieldProofMempoolDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.ShieldProofMempool);
  }

  async createCollectionIndices() {
    await this.createIndex(['commitmentHash'], { unique: true });
  }

  async insertShieldProof(shieldProofData: ShieldProofData): Promise<void> {
    return this.insertOne(shieldProofData);
  }

  async proofExists(commitmentHash: string): Promise<boolean> {
    const filter: DBFilter<ShieldProofMempoolDBItem> = {
      commitmentHash,
    };
    return this.exists(filter);
  }

  async getShieldProof(
    commitmentHash: string,
  ): Promise<Optional<ShieldProofMempoolDBItem>> {
    return this.findOne({ commitmentHash });
  }

  async getShieldProofForBlindedCommitment(
    blindedCommitment: string,
  ): Promise<Optional<ShieldProofMempoolDBItem>> {
    return this.findOne({ blindedCommitment });
  }

  async proofExistsForBlindedCommitment(
    blindedCommitment: string,
  ): Promise<boolean> {
    return this.exists({ blindedCommitment });
  }

  async streamShieldProofs(): Promise<DBStream<ShieldProofMempoolDBItem>> {
    return this.stream();
  }
}
