/// <reference types="../types/index" />
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { TestMockListProviderExcludeSingleAddress } from '../tests/list-providers/test-mock-list-provider-exclude-single-address.test';
import { PollStatus } from '../models/general-types';
import { poll } from '@railgun-community/shared-models';
import { MOCK_LIST_KEYS } from '../tests/mocks.test';

chai.use(chaiAsPromised);
// const { expect } = chai;

let nodeWithListProvider: ProofOfInnocenceNode;

let nodeOnlyAggregator: ProofOfInnocenceNode;

const PORT_1 = '3010';
const PORT_2 = '3011';

describe('proof-of-innocence-node', () => {
  before(async function run() {
    this.timeout(10000);

    nodeOnlyAggregator = new ProofOfInnocenceNode(
      '0.0.0.0',
      PORT_2,
      [], // No connected nodes
      undefined,
    );
    await nodeOnlyAggregator.start();

    const testListProvider = new TestMockListProviderExcludeSingleAddress(
      MOCK_LIST_KEYS[0],
    );
    nodeWithListProvider = new ProofOfInnocenceNode(
      '0.0.0.0',
      PORT_1,
      [{ name: 'test', nodeURL: `http://localhost:${PORT_2}` }],
      testListProvider,
    );
  });

  after(async () => {
    await nodeOnlyAggregator.stop();
    await nodeWithListProvider.stop();
  });

  it('Should start up a node with list provider', async () => {
    await nodeWithListProvider.start();

    // Check that the node is an instance of ProofOfInnocenceNode
    expect(nodeWithListProvider).to.be.an.instanceOf(ProofOfInnocenceNode);

    expect(nodeWithListProvider.getPollStatus()).to.equal(PollStatus.IDLE);

    // Poll until PollStatus is POLLING.
    const pollStatusPolling = await poll(
      async () => nodeWithListProvider.getPollStatus(),
      status => status === PollStatus.POLLING,
      20,
      5000 / 20, // 5 sec.
    );
    if (pollStatusPolling !== PollStatus.POLLING) {
      throw new Error(
        `Should be polling, got ${nodeWithListProvider.getPollStatus()}`,
      );
    }

    await nodeWithListProvider.stop();
  }).timeout(20000);

  it('Should start up a node with only aggregator', async () => {
    await nodeOnlyAggregator.start();
    await nodeOnlyAggregator.stop();
  }).timeout(10000);
});
