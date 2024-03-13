import { BloomFilter, CountingBloomFilter } from 'bloom-filters';
import { bytesToBase64, base64ToBytes } from 'byte-base64';
import { compressToUTF16, decompressFromUTF16 } from 'lz-string';

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
    return bytesToBase64(filter._filter.array);
  }

  static deserialize(serialized: string): BloomFilter {
    const filter = POINodeBloomFilter.create();
    filter._filter.array = base64ToBytes(serialized);
    return filter;
  }
}

export class POINodeCountingBloomFilter {
  static create(
    size: number = SIZE_IN_BITS,
    hashes = NUMBER_OF_HASHES,
  ): CountingBloomFilter {
    const filter = new CountingBloomFilter(size, hashes);
    filter._seed = SEED;
    return filter;
  }

  static serialize(filter: CountingBloomFilter): string {
    let str = '';
    for (let i = 0; i < filter._filter.length; i++) {
      const count = filter._filter[i][1];
      if (count > 35) {
        // This means that the bloom filter has too many overlapping elements
        // and we should probably use better parameters.
        throw new Error('CountingBloomFilter count too high for serialization');
      }
      str += count.toString(36);
    }
    return compressToUTF16(str);
  }

  static deserialize(
    serialized: string,
    size: number = SIZE_IN_BITS,
    hashes: number = NUMBER_OF_HASHES,
  ): CountingBloomFilter {
    const filter = POINodeCountingBloomFilter.create(size, hashes);
    const str = decompressFromUTF16(serialized);
    for (let i = 0; i < str.length; i++) {
      const count = parseInt(str[i], 36);
      if (count > 0) {
        filter._filter[i][0] = 1;
        filter._filter[i][1] = count;
      }
    }
    return filter;
  }
}
