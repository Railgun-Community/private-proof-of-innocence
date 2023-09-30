import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { AbstractDatabase } from '../abstract-database';
import {
  CollectionName,
  BlockedShieldsPerListDBItem,
  DBStream,
  DBFilter,
} from '../../models/database-types';
import { SignedBlockedShield } from '../../models/poi-types';

export class BlockedShieldsPerListDatabase extends AbstractDatabase<BlockedShieldsPerListDBItem> {
  constructor(networkName: NetworkName, txidVersion: TXIDVersion) {
    super(networkName, txidVersion, CollectionName.BlockedShieldsPerList);
  }

  async createCollectionIndices() {
    await this.createIndex(['listKey', 'blindedCommitment'], { unique: true });
  }

  async insertSignedBlockedShield(
    listKey: string,
    signedBlockedShield: SignedBlockedShield,
  ): Promise<void> {
    const item: BlockedShieldsPerListDBItem = {
      listKey,
      commitmentHash: signedBlockedShield.commitmentHash,
      blindedCommitment: signedBlockedShield.blindedCommitment,
      blockReason: signedBlockedShield.blockReason,
      signature: signedBlockedShield.signature,
    };
    await this.insertOne(item);
  }

  async streamBlockedShields(
    listKey: string,
  ): Promise<DBStream<BlockedShieldsPerListDBItem>> {
    const filter: DBFilter<BlockedShieldsPerListDBItem> = {
      listKey,
    };
    return this.stream(filter);
  }

  async getBlockedShields(
    listKey: string,
  ): Promise<BlockedShieldsPerListDBItem[]> {
    const filter: DBFilter<BlockedShieldsPerListDBItem> = {
      listKey,
    };
    return this.findAll(filter);
  }

  async isShieldBlockedByList(
    listKey: string,
    blindedCommitment: string,
  ): Promise<boolean> {
    return this.exists({ listKey, blindedCommitment });
  }
}
