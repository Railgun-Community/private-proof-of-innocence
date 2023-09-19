import { NetworkName } from '@railgun-community/shared-models';
import { POINodeBloomFilter } from '../util/poi-node-bloom-filters';
import { BloomFilter } from 'bloom-filters';
import { SignedBlockedShield } from '../models/poi-types';

export class BlockedShieldsCache {
  // { listKey: {networkName: {blindedCommitment: SignedBlockedShield} } }
  private static blockedShieldsCache: Record<
    string,
    Partial<Record<NetworkName, Map<string, SignedBlockedShield>>>
  > = {};

  private static bloomFilters: Record<
    string,
    Partial<Record<NetworkName, BloomFilter>>
  > = {};

  static getBlockedShields(
    listKey: string,
    networkName: NetworkName,
  ): SignedBlockedShield[] {
    const cache = this.getCacheForNetworkAndList(listKey, networkName);
    return Array.from(cache.values());
  }

  static getCacheSize(listKey: string, networkName: NetworkName): number {
    const cache = this.getCacheForNetworkAndList(listKey, networkName);
    return cache.size;
  }

  private static getCacheForNetworkAndList(
    listKey: string,
    networkName: NetworkName,
  ) {
    this.blockedShieldsCache[listKey] ??= {};

    const cacheForList = this.blockedShieldsCache[listKey] as Record<
      string,
      Map<string, SignedBlockedShield>
    >;

    cacheForList[networkName] ??= new Map();
    return cacheForList[networkName];
  }

  static addToCache(
    listKey: string,
    networkName: NetworkName,
    signedBlockedShield: SignedBlockedShield,
  ) {
    const cache = this.getCacheForNetworkAndList(listKey, networkName);

    const { blindedCommitment } = signedBlockedShield;
    cache.set(blindedCommitment, signedBlockedShield);

    this.addToBloomFilter(listKey, networkName, blindedCommitment);
  }

  private static getBloomFilter(
    listKey: string,
    networkName: NetworkName,
  ): BloomFilter {
    this.bloomFilters[listKey] ??= {};
    this.bloomFilters[listKey][networkName] ??= POINodeBloomFilter.create();
    return this.bloomFilters[listKey][networkName] as BloomFilter;
  }

  private static addToBloomFilter(
    listKey: string,
    networkName: NetworkName,
    blindedCommitment: string,
  ) {
    this.getBloomFilter(listKey, networkName).add(blindedCommitment);
  }

  static serializeBloomFilter(
    listKey: string,
    networkName: NetworkName,
  ): string {
    return POINodeBloomFilter.serialize(
      this.getBloomFilter(listKey, networkName),
    );
  }

  static clearCache_FOR_TEST_ONLY() {
    this.blockedShieldsCache = {};
    this.bloomFilters = {};
  }
}
