import { NetworkName } from '@railgun-community/shared-models';
import { TransactProofData } from '../models/proof-types';
import { CountingBloomFilter } from 'bloom-filters';

export class TransactProofMempoolCache {
  // { listKey: {networkName: {blindedCommitmentFirstInput: TransactProofData} } }
  private static transactProofMempoolCache: Record<
    string,
    Partial<Record<NetworkName, Map<string, TransactProofData>>>
  > = {};

  private static bloomFilter: CountingBloomFilter;

  static async init() {
    // For 100,000 elements, approx 1/1_000_000 false positive rate.
    const sizeInBits = 2_875_518;
    const numberHashes = 20;

    TransactProofMempoolCache.bloomFilter = new CountingBloomFilter(
      sizeInBits,
      numberHashes,
    );
  }

  private static getCacheForNetworkAndList(
    networkName: NetworkName,
    listKey: string,
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
      networkName,
      listKey,
    );

    const blindedCommitmentFirstInput =
      transactProofData.publicInputs.blindedCommitmentInputs[0];
    cache.set(blindedCommitmentFirstInput, transactProofData);

    TransactProofMempoolCache.addToBloomFilter(blindedCommitmentFirstInput);
  }

  static removeFromCache(
    listKey: string,
    networkName: NetworkName,
    blindedCommitmentFirstInput: string,
  ) {
    const cache = TransactProofMempoolCache.getCacheForNetworkAndList(
      networkName,
      listKey,
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

  static getBloomFilterData(): object {
    return TransactProofMempoolCache.bloomFilter.saveAsJSON();
  }
}
