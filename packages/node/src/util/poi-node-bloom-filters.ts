import { BloomFilter, CountingBloomFilter } from 'bloom-filters';
import { fromBase64, toBase64 } from './base64';
import bits from 'bits-to-bytes';

// For 100,000 elements, approx 1/1_000_000 false positive rate.
const SIZE_IN_BITS = 2_875_518;
const NUMBER_OF_HASHES = 20;
const SEED = 0;

export class POINodeBloomFilter {
  static create(): BloomFilter {
    const filter = new BloomFilter(SIZE_IN_BITS, NUMBER_OF_HASHES);
    filter._seed = SEED;
    return filter;
  }

  static serialize(filter: BloomFilter): string {
    return toBase64(filter._filter.array);
  }

  static deserialize(serialized: string): BloomFilter {
    const filter = POINodeBloomFilter.create();
    filter._filter.array = fromBase64(serialized);
    return filter;
  }
}

export class POINodeCountingBloomFilter {
  static create(): CountingBloomFilter {
    const filter = new CountingBloomFilter(SIZE_IN_BITS, NUMBER_OF_HASHES);
    filter._seed = SEED;
    return filter;
  }

  static serialize(filter: CountingBloomFilter): string {
    const bitArray: number[] = filter._filter.map(element => element[0]);
    const buffer: Uint8Array = bits.from(bitArray);
    return toBase64(buffer);
  }

  static deserialize(serialized: string): CountingBloomFilter {
    const filter = POINodeCountingBloomFilter.create();
    filter._filter = [...bits.iterator(fromBase64(serialized))].map(element => [
      Number(element),
      Number(element),
    ]);
    return filter;
  }
}
