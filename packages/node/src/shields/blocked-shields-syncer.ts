import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { POINodeCountingBloomFilter } from '../util/poi-node-bloom-filters';
import { QueryLimits } from '../config/query-limits';
import { Config } from '../config/config';
import { SignedBlockedShield } from '../models/poi-types';
import { BlockedShieldsPerListDatabase } from '../database/databases/blocked-shields-per-list-database';
import { BlockedShieldsCache } from './blocked-shields-cache';
import { verifyBlockedShield } from '../util/ed25519';

export class BlockedShieldsSyncer {
  static async addSignedBlockedShield(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    signedBlockedShield: SignedBlockedShield,
  ) {
    const shouldAdd = await this.shouldAdd(
      listKey,
      networkName,
      txidVersion,
      signedBlockedShield,
    );
    if (!shouldAdd) {
      return;
    }

    const db = new BlockedShieldsPerListDatabase(networkName, txidVersion);
    await db.insertSignedBlockedShield(listKey, signedBlockedShield);

    BlockedShieldsCache.addToCache(listKey, networkName, signedBlockedShield);
  }

  private static async shouldAdd(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    signedBlockedShield: SignedBlockedShield,
  ): Promise<boolean> {
    // 1. Verify that doesn't already exist
    const db = new BlockedShieldsPerListDatabase(networkName, txidVersion);
    const exists = await db.isShieldBlockedByList(
      listKey,
      signedBlockedShield.blindedCommitment,
    );
    if (exists) {
      return false;
    }

    // 2. Verify signature
    const verifiedSignature = await verifyBlockedShield(
      signedBlockedShield,
      listKey,
    );
    if (!verifiedSignature) {
      throw new Error(`Signature invalid for blocked shield`);
    }

    return true;
  }

  static async inflateCacheFromDatabase(listKeys: string[]) {
    for (const networkName of Config.NETWORK_NAMES) {
      for (const txidVersion of Config.TXID_VERSIONS) {
        const db = new BlockedShieldsPerListDatabase(networkName, txidVersion);

        for (const listKey of listKeys) {
          const blockedShieldsStream = await db.streamBlockedShields(listKey);

          for await (const blockedShieldDBItem of blockedShieldsStream) {
            const blockedShieldData: SignedBlockedShield = {
              commitmentHash: blockedShieldDBItem.commitmentHash,
              blindedCommitment: blockedShieldDBItem.blindedCommitment,
              blockReason: blockedShieldDBItem.blockReason ?? undefined,
              signature: blockedShieldDBItem.signature,
            };
            BlockedShieldsCache.addToCache(
              listKey,
              networkName,
              blockedShieldData,
            );
          }
        }
      }
    }
  }

  static getFilteredBlockedShields(
    listKey: string,
    networkName: NetworkName,
    bloomFilterSerialized: string,
  ): SignedBlockedShield[] {
    const blockedShieldDatas: SignedBlockedShield[] =
      BlockedShieldsCache.getBlockedShields(listKey, networkName);

    const bloomFilter = POINodeCountingBloomFilter.deserialize(
      bloomFilterSerialized,
    );

    const filteredProofs: SignedBlockedShield[] = blockedShieldDatas.filter(
      blockedShieldData => {
        return !bloomFilter.has(blockedShieldData.blindedCommitment);
      },
    );
    return filteredProofs.slice(0, QueryLimits.PROOF_MEMPOOL_SYNCED_ITEMS);
  }
}
