import { NetworkName } from '@railgun-community/shared-models';
import {
  CollectionName,
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

  async insertValidShieldProof(item: ShieldProofMempoolDBItem): Promise<void> {
    return this.insertOne(item);
  }
}
