import { NetworkName } from '@railgun-community/shared-models';
import { TransactProofData } from '../models/proof-types';
import { ProofMempoolCountingBloomFilter } from './proof-mempool-bloom-filters';

export class TransactProofMempoolCache {
  // { listKey: {networkName: {firstBlindedCommitmentInput: TransactProofData} } }
  private static transactProofMempoolCache: Record<
    string,
    Partial<Record<NetworkName, Map<string, TransactProofData>>>
  > = {};

  private static bloomFilter = ProofMempoolCountingBloomFilter.create();

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

    const firstBlindedCommitmentInput =
      transactProofData.blindedCommitmentInputs[0];
    cache.set(firstBlindedCommitmentInput, transactProofData);

    TransactProofMempoolCache.addToBloomFilter(firstBlindedCommitmentInput);
  }

  static removeFromCache(
    listKey: string,
    networkName: NetworkName,
    firstBlindedCommitmentInput: string,
  ) {
    const cache = TransactProofMempoolCache.getCacheForNetworkAndList(
      listKey,
      networkName,
    );
    cache.delete(firstBlindedCommitmentInput);

    TransactProofMempoolCache.removeFromBloomFilter(
      firstBlindedCommitmentInput,
    );
  }

  private static addToBloomFilter(firstBlindedCommitmentInput: string) {
    TransactProofMempoolCache.bloomFilter.add(firstBlindedCommitmentInput);
  }

  private static removeFromBloomFilter(firstBlindedCommitmentInput: string) {
    TransactProofMempoolCache.bloomFilter.remove(firstBlindedCommitmentInput);
  }

  static serializeBloomFilter(): string {
    return ProofMempoolCountingBloomFilter.serialize(
      TransactProofMempoolCache.bloomFilter,
    );
  }

  static clearCache_FOR_TEST_ONLY() {
    this.transactProofMempoolCache = {};
    this.bloomFilter = ProofMempoolCountingBloomFilter.create();
  }
}
