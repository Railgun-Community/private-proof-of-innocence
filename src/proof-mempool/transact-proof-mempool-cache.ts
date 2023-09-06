import { NetworkName } from '@railgun-community/shared-models';
import { TransactProofData } from '../models/proof-types';
import { CountingBloomFilter } from 'bloom-filters';
import { ProofMempoolCountingBloomFilter } from './proof-mempool-bloom-filters';

export class TransactProofMempoolCache {
  // { listKey: {networkName: {blindedCommitmentFirstInput: TransactProofData} } }
  private static transactProofMempoolCache: Record<
    string,
    Partial<Record<NetworkName, Map<string, TransactProofData>>>
  > = {};

  private static bloomFilter: CountingBloomFilter;

  static async init() {
    TransactProofMempoolCache.bloomFilter =
      ProofMempoolCountingBloomFilter.create();
  }

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

    const blindedCommitmentFirstInput =
      transactProofData.blindedCommitmentInputs[0];
    cache.set(blindedCommitmentFirstInput, transactProofData);

    TransactProofMempoolCache.addToBloomFilter(blindedCommitmentFirstInput);
  }

  static removeFromCache(
    listKey: string,
    networkName: NetworkName,
    blindedCommitmentFirstInput: string,
  ) {
    const cache = TransactProofMempoolCache.getCacheForNetworkAndList(
      listKey,
      networkName,
    );
    cache.delete(blindedCommitmentFirstInput);

    TransactProofMempoolCache.removeFromBloomFilter(
      blindedCommitmentFirstInput,
    );
  }

  private static addToBloomFilter(blindedCommitmentFirstInput: string) {
    TransactProofMempoolCache.bloomFilter.add(blindedCommitmentFirstInput);
  }

  private static removeFromBloomFilter(blindedCommitmentFirstInput: string) {
    TransactProofMempoolCache.bloomFilter.remove(blindedCommitmentFirstInput);
  }

  static serializeBloomFilter(): string {
    return ProofMempoolCountingBloomFilter.serialize(
      TransactProofMempoolCache.bloomFilter,
    );
  }
}
