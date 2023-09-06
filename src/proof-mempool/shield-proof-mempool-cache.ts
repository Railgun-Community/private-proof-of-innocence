import { NetworkName } from '@railgun-community/shared-models';
import { ShieldProofData } from '../models/proof-types';
import { ProofMempoolBloomFilter } from './proof-mempool-bloom-filters';

export class ShieldProofMempoolCache {
  private static shieldProofMempoolCache: Partial<
    Record<NetworkName, ShieldProofData[]>
  > = {};

  private static bloomFilter = ProofMempoolBloomFilter.create();

  static getShieldProofs(networkName: NetworkName): ShieldProofData[] {
    return this.shieldProofMempoolCache[networkName] ?? [];
  }

  static addToCache(
    networkName: NetworkName,
    shieldProofData: ShieldProofData,
  ) {
    this.shieldProofMempoolCache[networkName] ??= [];
    this.shieldProofMempoolCache[networkName]?.push(shieldProofData);

    this.addToBloomFilter(shieldProofData.commitmentHash);
  }

  private static addToBloomFilter(commitmentHash: string) {
    ShieldProofMempoolCache.bloomFilter.add(commitmentHash);
  }

  static serializeBloomFilter(): string {
    return ProofMempoolBloomFilter.serialize(
      ShieldProofMempoolCache.bloomFilter,
    );
  }
}
