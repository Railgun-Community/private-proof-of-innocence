/// <reference types="../types/index" />
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { TestMockListProviderExcludeSingleAddress } from '../tests/list-providers/test-mock-list-provider-exclude-single-address.test';

chai.use(chaiAsPromised);
// const { expect } = chai;

let nodeWithListProvider: ProofOfInnocenceNode;

let nodeOnlyAggregator: ProofOfInnocenceNode;

describe('proof-of-innocence-node', () => {
  before(() => {
    const listProvider = new TestMockListProviderExcludeSingleAddress();
    nodeWithListProvider = new ProofOfInnocenceNode(listProvider);
  });

  it('Should start up a node with list provider', async () => {
    await nodeWithListProvider.start();
    await nodeWithListProvider.stop();
  }).timeout(10000);

  it('Should start up a node with only aggregator', async () => {
    await nodeOnlyAggregator.start();
    await nodeOnlyAggregator.stop();
  }).timeout(10000);
});
