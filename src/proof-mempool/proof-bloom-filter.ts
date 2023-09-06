import { BloomFilter, CountingBloomFilter } from 'bloom-filters';

// For 100,000 elements, approx 1/1_000_000 false positive rate.
const SIZE_IN_BITS = 2_875_518;
const NUMBER_OF_HASHES = 20;

export class ProofBloomFilter {
  static createBloomFilter(): BloomFilter {
    const filter = new BloomFilter(SIZE_IN_BITS, NUMBER_OF_HASHES);
    filter._seed = 0;
    return filter;
  }

  static createCountingBloomFilter(): CountingBloomFilter {
    const filter = new CountingBloomFilter(SIZE_IN_BITS, NUMBER_OF_HASHES);
    filter._seed = 0;
    return filter;
  }
}
