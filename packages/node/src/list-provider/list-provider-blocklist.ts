import { NetworkName } from '@railgun-community/shared-models';
import { BlockedShieldsPerListDatabase } from '../database/databases/blocked-shields-per-list-database';
import { ShieldQueueDBItem } from '../models/database-types';
import { signBlockedShield } from '../util/ed25519';

export class ListProviderBlocklist {
  private static listKey: string;

  static init(listKey: string) {
    this.listKey = listKey;
  }

  static async addBlockedShield(
    networkName: NetworkName,
    shieldDBItem: ShieldQueueDBItem,
    blockReason: Optional<string>,
  ): Promise<void> {
    const db = new BlockedShieldsPerListDatabase(networkName);

    const signature = await signBlockedShield(
      shieldDBItem.commitmentHash,
      shieldDBItem.blindedCommitment,
      blockReason,
    );

    await db.insertBlockedShield(
      this.listKey,
      shieldDBItem.commitmentHash,
      shieldDBItem.blindedCommitment,
      blockReason,
      signature,
    );
  }
}
