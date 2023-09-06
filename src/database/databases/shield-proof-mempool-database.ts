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
    return this.insertOne(shieldProofData);
  }

  async getAllShieldProofs(): Promise<ShieldProofData[]> {
    // TODO: Add a filter based on createdAt?
    const shieldProofs = await this.findAll();
    return shieldProofs;
  }
}
