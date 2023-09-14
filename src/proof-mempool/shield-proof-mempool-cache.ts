import { NetworkName } from '@railgun-community/shared-models';
import { ShieldProofData } from '../models/proof-types';
import { ProofMempoolBloomFilter } from './proof-mempool-bloom-filters';
import { BloomFilter } from 'bloom-filters';

export class ShieldProofMempoolCache {
  private static shieldProofMempoolCache: Partial<
    Record<NetworkName, ShieldProofData[]>
  > = {};

  private static bloomFilters: Partial<Record<NetworkName, BloomFilter>> = {};

  static getShieldProofs(networkName: NetworkName): ShieldProofData[] {
    return ShieldProofMempoolCache.shieldProofMempoolCache[networkName] ?? [];
  }

  static addToCache(
    networkName: NetworkName,
    shieldProofData: ShieldProofData,
  ) {
    ShieldProofMempoolCache.shieldProofMempoolCache[networkName] ??= [];
    ShieldProofMempoolCache.shieldProofMempoolCache[networkName]?.push(
      shieldProofData,
    );

    ShieldProofMempoolCache.addToBloomFilter(
      networkName,
      shieldProofData.commitmentHash,
    );
  }

  private static getBloomFilter(networkName: NetworkName): BloomFilter {
    ShieldProofMempoolCache.bloomFilters[networkName] ??=
      ProofMempoolBloomFilter.create();
    return ShieldProofMempoolCache.bloomFilters[networkName] as BloomFilter;
  }

  private static addToBloomFilter(
    networkName: NetworkName,
    commitmentHash: string,
  ) {
    ShieldProofMempoolCache.getBloomFilter(networkName).add(commitmentHash);
  }

  static serializeBloomFilter(networkName: NetworkName): string {
    return ProofMempoolBloomFilter.serialize(
      ShieldProofMempoolCache.getBloomFilter(networkName),
    );
  }

  static clearCache_FOR_TEST_ONLY() {
    ShieldProofMempoolCache.shieldProofMempoolCache = {};
    ShieldProofMempoolCache.bloomFilters = {};
  }

  static bloomFilterIncludesCommitmentHash(
    networkName: NetworkName,
    commitmentHash: string,
  ): boolean {
    return this.getBloomFilter(networkName).has(commitmentHash);
  }
}
