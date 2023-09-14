/// <reference types="../types/index" />
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { TestMockListProviderExcludeSingleAddress } from '../tests/list-providers/test-mock-list-provider-exclude-single-address.test';
import net from 'net';
import { Config } from '../config/config';

chai.use(chaiAsPromised);
// const { expect } = chai;

let nodeWithListProvider: ProofOfInnocenceNode;

let nodeOnlyAggregator: ProofOfInnocenceNode;

const PORT_1 = '3010';
const PORT_2 = '3011';

describe('proof-of-innocence-node', () => {
  before(() => {
    const testListProvider = new TestMockListProviderExcludeSingleAddress();

    nodeWithListProvider = new ProofOfInnocenceNode(
      '0.0.0.0',
      PORT_1,
      [`http://localhost:${PORT_2}`],
      testListProvider,
    );
    nodeOnlyAggregator = new ProofOfInnocenceNode(
      '0.0.0.0',
      PORT_2,
      [`http://localhost:${PORT_1}`],
      undefined,
    );
  });

  it('Should start up a node with list provider', async () => {
    await nodeWithListProvider.start();

    // Check that the node is an instance of ProofOfInnocenceNode
    expect(nodeWithListProvider).to.be.an.instanceOf(ProofOfInnocenceNode);

    // TODO: prove it's running

    await nodeWithListProvider.stop();

    // TODO: prove it's stopped
  }).timeout(10000);

  it('Should start up a node with only aggregator', async () => {
    await nodeOnlyAggregator.start();
    await nodeOnlyAggregator.stop();
  }).timeout(10000);
});
