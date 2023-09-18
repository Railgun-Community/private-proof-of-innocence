import { NetworkName , ShieldProofData } from '@railgun-community/shared-models';
import { ProofMempoolBloomFilter } from './proof-mempool-bloom-filters';
import { BloomFilter } from 'bloom-filters';

export class ShieldProofMempoolCache {
  private static numInCache: Partial<Record<NetworkName, number>> = {};

  private static bloomFilters: Partial<Record<NetworkName, BloomFilter>> = {};

  static addToCache(
    networkName: NetworkName,
    shieldProofData: ShieldProofData,
  ) {
    ShieldProofMempoolCache.incrementNumInCache(networkName);
    ShieldProofMempoolCache.addToBloomFilter(
      networkName,
      shieldProofData.commitmentHash,
    );
  }

  private static incrementNumInCache(networkName: NetworkName) {
    const numInCache = ShieldProofMempoolCache.getNumInCache(networkName);
    ShieldProofMempoolCache.numInCache[networkName] = numInCache + 1;
  }

  static getNumInCache(networkName: NetworkName) {
    return ShieldProofMempoolCache.numInCache[networkName] ?? 0;
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
    ShieldProofMempoolCache.numInCache = {};
    ShieldProofMempoolCache.bloomFilters = {};
  }

  static bloomFilterIncludesCommitmentHash(
    networkName: NetworkName,
    commitmentHash: string,
  ): boolean {
    return this.getBloomFilter(networkName).has(commitmentHash);
  }
}
