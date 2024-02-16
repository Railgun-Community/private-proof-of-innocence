import {
  NetworkName,
  TXIDVersion,
  TransactProofData,
} from '@railgun-community/shared-models';
import { POINodeCountingBloomFilter } from '../util/poi-node-bloom-filters';
import { CountingBloomFilter } from 'bloom-filters';
import { Config } from '../config/config';

type BlindedCommitmentMap = Map<string, TransactProofData>;
// { listKey: {networkName: { txidVersion: {getBlindedCommitmentsCacheString: TransactProofData} } } }
type TransactCacheType = Record<
  string,
  Partial<
    Record<NetworkName, Partial<Record<TXIDVersion, BlindedCommitmentMap>>>
  >
>;

export class TransactProofMempoolCache {
  private static transactProofMempoolCache: TransactCacheType = {};

  private static bloomFilters: Record<
    string,
    Partial<
      Record<NetworkName, Partial<Record<TXIDVersion, CountingBloomFilter>>>
    >
  > = {};

  static getTransactProofs(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): TransactProofData[] {
    const cache = this.getCache(listKey, networkName, txidVersion);
    return Array.from(cache.values());
  }

  /**
   * Returns the number of items in the cache for a given list key, network name, and transaction ID version.
   *
   * @param listKey - A string key to identify the specific list in the cache.
   * @param networkName - The network name, used as a second-level key in the cache.
   * @param txidVersion - The version of the transaction ID, determining the final level of caching.
   * @returns The number of items in the cache for the given parameters.
   */
  static getCacheSize(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): number {
    const cache = this.getCache(listKey, networkName, txidVersion);
    return cache.size;
  }

  /**
   * Retrieves a cache map specific to a given list key, network name, and transaction ID version.
   * If the cache for the given list key or network name doesn't exist, it initializes them.
   *
   * The method ensures that each level of cache (listKey, networkName) is properly instantiated
   * before attempting to access or modify it. This prevents potential runtime errors due to
   * undefined cache segments.
   *
   * @remarks
   * The cache is structured to first segregate by `listKey`, then by `networkName`,
   * and finally by the `txidVersion`. Each segment is lazily initialized if not already present.
   *
   * @param listKey - A string key to identify the specific list in the cache.
   * @param networkName - The network name, used as a second-level key in the cache.
   * @param txidVersion - The version of the transaction ID, determining the final level of caching.
   * @returns A `BlindedCommitmentMap` object representing the specific cache for the given parameters.
   */
  private static getCache(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ) {
    // If the cache for the listKey doesn't exist, create it
    this.transactProofMempoolCache[listKey] ??= {};

    // Get the specific cache for the listKey, cast to TransactCacheType type
    const cacheForList = this.transactProofMempoolCache[
      listKey
    ] as TransactCacheType['listKey'];

    // If the cache for the networkName doesn't exist, create it
    cacheForList[networkName] ??= Config.TXID_VERSIONS.reduce(
      (acc, txidVersion) => {
        acc[txidVersion] = new Map();
        return acc;
      },
      {} as Record<TXIDVersion, BlindedCommitmentMap>,
    );

    // Return specific cache map for networkName and txidVersion, cast to BlindedCommitmentMap type
    return cacheForList[networkName]?.[txidVersion] as BlindedCommitmentMap;
  }

  static getBlindedCommitmentsCacheString(
    blindedCommitmentsOut: string[],
    railgunTxidIfHasUnshield: string,
  ) {
    return [...blindedCommitmentsOut, railgunTxidIfHasUnshield].join('|');
  }

  /**
   * Adds a transact proof to the mempool cache.
   *
   * @param listKey
   * @param networkName
   * @param txidVersion
   * @param transactProofData
   */
  static addToCache(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ) {
    const cache = this.getCache(listKey, networkName, txidVersion);

    cache.set(
      this.getBlindedCommitmentsCacheString(
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
      ),
      transactProofData,
    );

    this.addToBloomFilter(
      listKey,
      networkName,
      txidVersion,
      transactProofData.blindedCommitmentsOut,
      transactProofData.railgunTxidIfHasUnshield,
    );
  }

  static removeFromCache(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitmentsOut: string[],
    railgunTxidIfHasUnshield: string,
  ) {
    const cache = this.getCache(listKey, networkName, txidVersion);
    cache.delete(
      this.getBlindedCommitmentsCacheString(
        blindedCommitmentsOut,
        railgunTxidIfHasUnshield,
      ),
    );

    this.removeFromBloomFilter(
      listKey,
      networkName,
      txidVersion,
      blindedCommitmentsOut,
      railgunTxidIfHasUnshield,
    );
  }

  private static getBloomFilter(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): CountingBloomFilter {
    this.bloomFilters[listKey] ??= {};
    this.bloomFilters[listKey][networkName] ??= {};
    (
      this.bloomFilters[listKey][networkName] as Partial<
        Record<TXIDVersion, CountingBloomFilter>
      >
    )[txidVersion] ??= POINodeCountingBloomFilter.create();
    return this.bloomFilters[listKey][networkName]?.[
      txidVersion
    ] as CountingBloomFilter;
  }

  private static addToBloomFilter(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitmentsOut: string[],
    railgunTxidIfHasUnshield: string,
  ) {
    this.getBloomFilter(listKey, networkName, txidVersion).add(
      this.getBlindedCommitmentsCacheString(
        blindedCommitmentsOut,
        railgunTxidIfHasUnshield,
      ),
    );
  }

  private static removeFromBloomFilter(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitmentsOut: string[],
    railgunTxidIfHasUnshield: string,
  ) {
    this.getBloomFilter(listKey, networkName, txidVersion).remove(
      this.getBlindedCommitmentsCacheString(
        blindedCommitmentsOut,
        railgunTxidIfHasUnshield,
      ),
    );
  }

  static serializeBloomFilter(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): string {
    return POINodeCountingBloomFilter.serialize(
      this.getBloomFilter(listKey, networkName, txidVersion),
    );
  }

  static clearCache_FOR_TEST_ONLY() {
    this.transactProofMempoolCache = {};
    this.bloomFilters = {};
  }
}
