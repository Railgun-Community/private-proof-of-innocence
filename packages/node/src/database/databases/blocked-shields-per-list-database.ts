import { NetworkName } from '@railgun-community/shared-models';
import { AbstractDatabase } from '../abstract-database';
import {
  CollectionName,
  BlockedShieldsPerListDBItem,
  DBStream,
  DBFilter,
} from '../../models/database-types';

export class BlockedShieldsPerListDatabase extends AbstractDatabase<BlockedShieldsPerListDBItem> {
  constructor(networkName: NetworkName) {
    super(networkName, CollectionName.BlockedShieldsPerList);
  }

  async createCollectionIndices() {
    await this.createIndex(['listKey', 'blindedCommitment'], { unique: true });
  }

  async insertBlockedShield(
    listKey: string,
    commitmentHash: string,
    blindedCommitment: string,
    blockReason: Optional<string>,
    signature: string,
  ): Promise<void> {
    const item: BlockedShieldsPerListDBItem = {
      listKey,
      commitmentHash,
      blindedCommitment,
      blockReason,
      signature,
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

  async isShieldBlockedByList(
    listKey: string,
    blindedCommitment: string,
  ): Promise<boolean> {
    return this.exists({ listKey, blindedCommitment });
  }
}
