import { NetworkName , TransactProofData } from '@railgun-community/shared-models';
import { ProofMempoolCountingBloomFilter } from './proof-mempool-bloom-filters';
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
    const cache = TransactProofMempoolCache.getCacheForNetworkAndList(
      listKey,
      networkName,
    );
    return Array.from(cache.values());
  }

  private static getCacheForNetworkAndList(
    listKey: string,
    networkName: NetworkName,
  ) {
    TransactProofMempoolCache.transactProofMempoolCache[listKey] ??= {};

    const cacheForList = TransactProofMempoolCache.transactProofMempoolCache[
      listKey
    ] as Record<string, Map<string, TransactProofData>>;

    cacheForList[networkName] ??= new Map();
    return cacheForList[networkName];
  }

  static addToCache(
    listKey: string,
    networkName: NetworkName,
    transactProofData: TransactProofData,
  ) {
    const cache = TransactProofMempoolCache.getCacheForNetworkAndList(
      listKey,
      networkName,
    );

    const firstBlindedCommitment =
      transactProofData.blindedCommitmentOutputs[0];
    cache.set(firstBlindedCommitment, transactProofData);

    TransactProofMempoolCache.addToBloomFilter(
      listKey,
      networkName,
      firstBlindedCommitment,
    );
  }

  static removeFromCache(
    listKey: string,
    networkName: NetworkName,
    firstBlindedCommitment: string,
  ) {
    const cache = TransactProofMempoolCache.getCacheForNetworkAndList(
      listKey,
      networkName,
    );
    cache.delete(firstBlindedCommitment);

    TransactProofMempoolCache.removeFromBloomFilter(
      listKey,
      networkName,
      firstBlindedCommitment,
    );
  }

  private static getBloomFilter(
    listKey: string,
    networkName: NetworkName,
  ): CountingBloomFilter {
    TransactProofMempoolCache.bloomFilters[listKey] ??= {};
    TransactProofMempoolCache.bloomFilters[listKey][networkName] ??=
      ProofMempoolCountingBloomFilter.create();
    return TransactProofMempoolCache.bloomFilters[listKey][
      networkName
    ] as CountingBloomFilter;
  }

  private static addToBloomFilter(
    listKey: string,
    networkName: NetworkName,
    firstBlindedCommitment: string,
  ) {
    TransactProofMempoolCache.getBloomFilter(listKey, networkName).add(
      firstBlindedCommitment,
    );
  }

  private static removeFromBloomFilter(
    listKey: string,
    networkName: NetworkName,
    firstBlindedCommitment: string,
  ) {
    TransactProofMempoolCache.getBloomFilter(listKey, networkName).remove(
      firstBlindedCommitment,
    );
  }

  static serializeBloomFilter(
    listKey: string,
    networkName: NetworkName,
  ): string {
    return ProofMempoolCountingBloomFilter.serialize(
      TransactProofMempoolCache.getBloomFilter(listKey, networkName),
    );
  }

  static clearCache_FOR_TEST_ONLY() {
    TransactProofMempoolCache.transactProofMempoolCache = {};
    TransactProofMempoolCache.bloomFilters = {};
  }
}
