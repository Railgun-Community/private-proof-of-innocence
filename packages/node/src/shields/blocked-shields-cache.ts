import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { POINodeBloomFilter } from '../util/poi-node-bloom-filters';
import { BloomFilter } from 'bloom-filters';
import { SignedBlockedShield } from '../models/poi-types';
import { Config } from 'config/config';

type BlindedCommitmentMap = Map<string, SignedBlockedShield>;
// { listKey: {networkName: {txidVersion: {blindedCommitment: SignedBlockedShield} } } }
type BlockedShieldsCacheType = Record<
  string,
  Partial<
    Record<NetworkName, Partial<Record<TXIDVersion, BlindedCommitmentMap>>>
  >
>;

export class BlockedShieldsCache {
  // { listKey: {networkName: {blindedCommitment: SignedBlockedShield} } }
  private static blockedShieldsCache: Record<
    string,
    Partial<Record<NetworkName, Map<string, SignedBlockedShield>>>
  > = {};

  private static bloomFilters: Record<
    string,
    Partial<Record<NetworkName, Partial<Record<TXIDVersion, BloomFilter>>>>
  > = {};

  static getBlockedShields(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): SignedBlockedShield[] {
    const cache = this.getCacheForNetworkAndList(
      listKey,
      networkName,
      txidVersion,
    );
    return Array.from(cache.values());
  }

  static getCacheSize(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): number {
    const cache = this.getCacheForNetworkAndList(
      listKey,
      networkName,
      txidVersion,
    );
    return cache.size;
  }

  private static getCacheForNetworkAndList(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ) {
    this.blockedShieldsCache[listKey] ??= {};

    const cacheForList = this.blockedShieldsCache[
      listKey
    ] as BlockedShieldsCacheType['listKey'];

    cacheForList[networkName] ??= Config.TXID_VERSIONS.reduce(
      (acc, txidVersion) => {
        acc[txidVersion] = new Map();
        return acc;
      },
      {} as Record<TXIDVersion, BlindedCommitmentMap>,
    );

    return cacheForList[networkName]?.[txidVersion] as BlindedCommitmentMap;
  }

  static addToCache(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    signedBlockedShield: SignedBlockedShield,
  ) {
    const cache = this.getCacheForNetworkAndList(
      listKey,
      networkName,
      txidVersion,
    );

    const { blindedCommitment } = signedBlockedShield;
    cache.set(blindedCommitment, signedBlockedShield);

    this.addToBloomFilter(listKey, networkName, txidVersion, blindedCommitment);
  }

  private static getBloomFilter(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): BloomFilter {
    this.bloomFilters[listKey] ??= {};
    this.bloomFilters[listKey][networkName] ??= {};
    (
      this.bloomFilters[listKey][networkName] as Partial<
        Record<TXIDVersion, BloomFilter>
      >
    )[txidVersion] ??= POINodeBloomFilter.create();
    return this.bloomFilters[listKey][networkName]?.[
      txidVersion
    ] as BloomFilter;
  }

  private static addToBloomFilter(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitment: string,
  ) {
    this.getBloomFilter(listKey, networkName, txidVersion).add(
      blindedCommitment,
    );
  }

  static serializeBloomFilter(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): string {
    return POINodeBloomFilter.serialize(
      this.getBloomFilter(listKey, networkName, txidVersion),
    );
  }

  static clearCache_FOR_TEST_ONLY() {
    this.blockedShieldsCache = {};
    this.bloomFilters = {};
  }
}
