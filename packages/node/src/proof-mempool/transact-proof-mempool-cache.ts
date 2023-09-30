import {
  NetworkName,
  TXIDVersion,
  TransactProofData,
} from '@railgun-community/shared-models';
import { POINodeCountingBloomFilter } from '../util/poi-node-bloom-filters';
import { CountingBloomFilter } from 'bloom-filters';

type BlindedCommitmentMap = Map<string, TransactProofData>;
// { listKey: {networkName: { txidVersion: {firstBlindedCommitment: TransactProofData} } } }
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

  static getCacheSize(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): number {
    const cache = this.getCache(listKey, networkName, txidVersion);
    return cache.size;
  }

  private static getCache(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ) {
    this.transactProofMempoolCache[listKey] ??= {};

    const cacheForList = this.transactProofMempoolCache[
      listKey
    ] as TransactCacheType['listKey'];

    cacheForList[networkName] ??= {
      [TXIDVersion.V2_PoseidonMerkle]: new Map(),
    };
    return cacheForList[networkName]?.[txidVersion] as BlindedCommitmentMap;
  }

  static addToCache(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    transactProofData: TransactProofData,
  ) {
    const cache = this.getCache(listKey, networkName, txidVersion);

    const firstBlindedCommitment =
      transactProofData.blindedCommitmentOutputs[0];
    cache.set(firstBlindedCommitment, transactProofData);

    this.addToBloomFilter(
      listKey,
      networkName,
      txidVersion,
      firstBlindedCommitment,
    );
  }

  static removeFromCache(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    firstBlindedCommitment: string,
  ) {
    const cache = this.getCache(listKey, networkName, txidVersion);
    cache.delete(firstBlindedCommitment);

    this.removeFromBloomFilter(
      listKey,
      networkName,
      txidVersion,
      firstBlindedCommitment,
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
    firstBlindedCommitment: string,
  ) {
    this.getBloomFilter(listKey, networkName, txidVersion).add(
      firstBlindedCommitment,
    );
  }

  private static removeFromBloomFilter(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    firstBlindedCommitment: string,
  ) {
    this.getBloomFilter(listKey, networkName, txidVersion).remove(
      firstBlindedCommitment,
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
