import { NetworkName } from '@railgun-community/shared-models';
import { ShieldProofData } from '../models/proof-types';
import { BloomFilter } from 'bloom-filters';

export class ShieldProofMempoolCache {
  private static shieldProofMempoolCache: Partial<
    Record<NetworkName, ShieldProofData[]>
  > = {};

  private static bloomFilter: BloomFilter;

  static async init() {
    // For 100,000 elements, approx 1/1_000_000 false positive rate.
    const sizeInBits = 2_875_518;
    const numberHashes = 20;

    ShieldProofMempoolCache.bloomFilter = new BloomFilter(
      sizeInBits,
      numberHashes,
    );
  }

  static addToCache(
    networkName: NetworkName,
    shieldProofData: ShieldProofData,
  ) {
    this.shieldProofMempoolCache[networkName] ??= [];
    this.shieldProofMempoolCache[networkName]?.push(shieldProofData);

    this.addToBloomFilter(shieldProofData.publicInputs.commitmentHash);
  }

  private static addToBloomFilter(commitmentHash: string) {
    ShieldProofMempoolCache.bloomFilter.add(commitmentHash);
  }

  static getBloomFilterData(): object {
    return ShieldProofMempoolCache.bloomFilter.saveAsJSON();
  }
}
