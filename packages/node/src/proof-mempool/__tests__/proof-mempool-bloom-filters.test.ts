import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  ProofMempoolBloomFilter,
  ProofMempoolCountingBloomFilter,
} from '../proof-mempool-bloom-filters';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('proof-mempool-bloom-filters', () => {
  before(() => {});

  it('Should create serializable BloomFilter', async () => {
    const bloomFilter = ProofMempoolBloomFilter.create();

    bloomFilter.add('hello');
    bloomFilter.add('world');

    expect(bloomFilter.has('hello')).to.be.true;
    expect(bloomFilter.has('world')).to.be.true;
    expect(bloomFilter.has('friend')).to.be.false;

    const serialized = ProofMempoolBloomFilter.serialize(bloomFilter);
    const deserialized = ProofMempoolBloomFilter.deserialize(serialized);

    expect(deserialized.has('hello')).to.be.true;
    expect(deserialized.has('world')).to.be.true;
    expect(deserialized.has('friend')).to.be.false;
  });

  it('Should create serializable CountingBloomFilter', async () => {
    const countingBloomFilter = ProofMempoolCountingBloomFilter.create();

    countingBloomFilter.add('hello');
    countingBloomFilter.add('world');

    expect(countingBloomFilter.has('hello')).to.be.true;

    countingBloomFilter.remove('hello');

    expect(countingBloomFilter.has('hello')).to.be.false;
    expect(countingBloomFilter.has('world')).to.be.true;
    expect(countingBloomFilter.has('friend')).to.be.false;

    const serialized =
      ProofMempoolCountingBloomFilter.serialize(countingBloomFilter);
    const deserialized =
      ProofMempoolCountingBloomFilter.deserialize(serialized);

    expect(countingBloomFilter.has('hello')).to.be.false;
    expect(deserialized.has('world')).to.be.true;
    expect(deserialized.has('friend')).to.be.false;
  });
});
