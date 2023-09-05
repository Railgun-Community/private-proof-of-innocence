/// <reference types="../types/index" />
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { TestMockListProviderExcludeSingleAddress } from '../tests/list-providers/test-mock-list-provider-exclude-single-address.test';

chai.use(chaiAsPromised);
// const { expect } = chai;

let node: ProofOfInnocenceNode;

describe('proof-of-innocence-node', () => {
  before(() => {
    const listProvider = new TestMockListProviderExcludeSingleAddress(
      'test-mock-list-provider',
    );
    node = new ProofOfInnocenceNode(listProvider);
  });

  after(async () => {
    await node.stop();
  });

  it('Should start up the node', async () => {
    await node.start();
  }).timeout(10000);
});
