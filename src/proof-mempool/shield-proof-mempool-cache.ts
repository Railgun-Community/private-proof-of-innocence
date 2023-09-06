import { NetworkName } from '@railgun-community/shared-models';
import { ShieldProofData } from '../models/proof-types';
import { BloomFilter } from 'bloom-filters';
import { ProofBloomFilter } from './proof-bloom-filter';

export class ShieldProofMempoolCache {
  private static shieldProofMempoolCache: Partial<
    Record<NetworkName, ShieldProofData[]>
  > = {};

  private static bloomFilter: BloomFilter;

  static async init() {
    ShieldProofMempoolCache.bloomFilter = ProofBloomFilter.createBloomFilter();
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

  static getBloomFilterData(): string {
    return ShieldProofMempoolCache.bloomFilter.saveAsJSON()._filter.content;
  }
}
