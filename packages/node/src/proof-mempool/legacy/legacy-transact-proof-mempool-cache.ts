import {
  NetworkName,
  TXIDVersion,
  LegacyTransactProofData,
} from '@railgun-community/shared-models';
import { POINodeBloomFilter } from '../../util/poi-node-bloom-filters';
import { BloomFilter } from 'bloom-filters';
import { Config } from '../../config/config';

type BlindedCommitmentMap = Map<string, LegacyTransactProofData>;
// { {networkName: { txidVersion: {blindedCommitment: LegacyTransactProofData} } }
type LegacyTransactCacheType = Partial<
  Record<NetworkName, Partial<Record<TXIDVersion, BlindedCommitmentMap>>>
>;

export class LegacyTransactProofMempoolCache {
  private static legacyTransactProofMempoolCache: LegacyTransactCacheType = {};

  private static bloomFilters: Partial<
    Record<NetworkName, Partial<Record<TXIDVersion, BloomFilter>>>
  > = {};

  static getLegacyTransactProofs(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): LegacyTransactProofData[] {
    const cache = this.getCache(networkName, txidVersion);
    return Array.from(cache.values());
  }

  static getCacheSize(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): number {
    const cache = this.getCache(networkName, txidVersion);
    return cache.size;
  }

  private static getCache(networkName: NetworkName, txidVersion: TXIDVersion) {
    this.legacyTransactProofMempoolCache[networkName] ??=
      Config.TXID_VERSIONS.reduce(
        (acc, txidVersion) => {
          acc[txidVersion] = new Map();
          return acc;
        },
        {} as Record<TXIDVersion, BlindedCommitmentMap>,
      );

    return this.legacyTransactProofMempoolCache[networkName]?.[
      txidVersion
    ] as BlindedCommitmentMap;
  }

  static addToCache(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    legacyTransactProofData: LegacyTransactProofData,
  ) {
    const cache = this.getCache(networkName, txidVersion);

    cache.set(
      legacyTransactProofData.blindedCommitment,
      legacyTransactProofData,
    );

    this.addToBloomFilter(
      networkName,
      txidVersion,
      legacyTransactProofData.blindedCommitment,
    );
  }

  private static getBloomFilter(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): BloomFilter {
    this.bloomFilters[networkName] ??= {};
    (
      this.bloomFilters[networkName] as Partial<
        Record<TXIDVersion, BloomFilter>
      >
    )[txidVersion] ??= POINodeBloomFilter.create();
    return this.bloomFilters[networkName]?.[txidVersion] as BloomFilter;
  }

  private static addToBloomFilter(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    firstBlindedCommitment: string,
  ) {
    this.getBloomFilter(networkName, txidVersion).add(firstBlindedCommitment);
  }

  static serializeBloomFilter(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): string {
    return POINodeBloomFilter.serialize(
      this.getBloomFilter(networkName, txidVersion),
    );
  }

  static clearCache_FOR_TEST_ONLY() {
    this.legacyTransactProofMempoolCache = {};
    this.bloomFilters = {};
  }
}
