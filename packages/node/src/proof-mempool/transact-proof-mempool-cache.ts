import {
  NetworkName,
  TransactProofData,
} from '@railgun-community/shared-models';
import { POINodeCountingBloomFilter } from '../util/poi-node-bloom-filters';
import { CountingBloomFilter } from 'bloom-filters';

export class TransactProofMempoolCache {
  // { listKey: {networkName: {firstBlindedCommitment: TransactProofData} } }
  private static transactProofMempoolCache: Record<
    string,
    Partial<Record<NetworkName, Map<string, TransactProofData>>>
  > = {};

  private static bloomFilters: Record<
    string,
    Partial<Record<NetworkName, CountingBloomFilter>>
  > = {};

  static getTransactProofs(
    listKey: string,
    networkName: NetworkName,
  ): TransactProofData[] {
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
    this.transactProofMempoolCache[listKey] ??= {};

    const cacheForList = this.transactProofMempoolCache[listKey] as Record<
      string,
      Map<string, TransactProofData>
    >;

    cacheForList[networkName] ??= new Map();
    return cacheForList[networkName];
  }

  static addToCache(
    listKey: string,
    networkName: NetworkName,
    transactProofData: TransactProofData,
  ) {
    const cache = this.getCacheForNetworkAndList(listKey, networkName);

    const firstBlindedCommitment =
      transactProofData.blindedCommitmentOutputs[0];
    cache.set(firstBlindedCommitment, transactProofData);

    this.addToBloomFilter(listKey, networkName, firstBlindedCommitment);
  }

  static removeFromCache(
    listKey: string,
    networkName: NetworkName,
    firstBlindedCommitment: string,
  ) {
    const cache = this.getCacheForNetworkAndList(listKey, networkName);
    cache.delete(firstBlindedCommitment);

    this.removeFromBloomFilter(listKey, networkName, firstBlindedCommitment);
  }

  private static getBloomFilter(
    listKey: string,
    networkName: NetworkName,
  ): CountingBloomFilter {
    this.bloomFilters[listKey] ??= {};
    this.bloomFilters[listKey][networkName] ??=
      POINodeCountingBloomFilter.create();
    return this.bloomFilters[listKey][networkName] as CountingBloomFilter;
  }

  private static addToBloomFilter(
    listKey: string,
    networkName: NetworkName,
    firstBlindedCommitment: string,
  ) {
    this.getBloomFilter(listKey, networkName).add(firstBlindedCommitment);
  }

  private static removeFromBloomFilter(
    listKey: string,
    networkName: NetworkName,
    firstBlindedCommitment: string,
  ) {
    this.getBloomFilter(listKey, networkName).remove(firstBlindedCommitment);
  }

  static serializeBloomFilter(
    listKey: string,
    networkName: NetworkName,
  ): string {
    return POINodeCountingBloomFilter.serialize(
      this.getBloomFilter(listKey, networkName),
    );
  }

  static clearCache_FOR_TEST_ONLY() {
    this.transactProofMempoolCache = {};
    this.bloomFilters = {};
  }
}
