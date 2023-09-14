/// <reference types="../types/index" />
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { TestMockListProviderExcludeSingleAddress } from '../tests/list-providers/test-mock-list-provider-exclude-single-address.test';
import axios from 'axios';

chai.use(chaiAsPromised);

describe('proof-of-innocence-node', () => {
  let nodeWithListProvider: ProofOfInnocenceNode;
  let nodeOnlyAggregator: ProofOfInnocenceNode;

  before(() => {
    const testListProvider = new TestMockListProviderExcludeSingleAddress();
    nodeWithListProvider = new ProofOfInnocenceNode(
      '0.0.0.0',
      '3010',
      testListProvider,
    );

    nodeOnlyAggregator = new ProofOfInnocenceNode('0.0.0.0', '3011');
  });

  it('Should start up a node with list provider', async () => {
    // TODO: is similar to api test
    await nodeWithListProvider.start();

    // Ping the API to see if it's running
    const response = await axios.get('http://0.0.0.0:3010/node-status');
    expect(response.status).to.equal(200);

    await nodeWithListProvider.stop();

    // Try pinging the API again, expect a failure
    await expect(axios.get('http://0.0.0.0:3010/node-status')).to.be.rejected;

  }).timeout(10000);

  it('Should start up a node with only aggregator', async () => {
    await nodeOnlyAggregator.start();
    await nodeOnlyAggregator.stop();
  }).timeout(10000);
});
