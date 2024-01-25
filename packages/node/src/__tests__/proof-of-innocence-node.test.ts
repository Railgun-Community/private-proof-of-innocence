/// <reference types="../types/index" />
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { TestMockListProviderExcludeSingleAddress } from '../tests/list-providers/test-mock-list-provider-exclude-single-address.test';
import { PollStatus } from '../models/general-types';
import { poll } from '@railgun-community/shared-models';
import { MOCK_LIST_KEYS } from '../tests/mocks.test';
import sinon from 'sinon';
import { POINodeRequest } from '../api/poi-node-request';
import axios from 'axios';

chai.use(chaiAsPromised);

let nodeWithListProvider: ProofOfInnocenceNode;

let nodeOnlyAggregator: ProofOfInnocenceNode;

const PORT_1 = '3010';
const PORT_2 = '3011';

describe('proof-of-innocence-node', () => {
  before(async function run() {
    nodeOnlyAggregator = new ProofOfInnocenceNode(
      '0.0.0.0',
      PORT_2,
      [], // No connected nodes
      undefined,
    );

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

  beforeEach(async function () {
    this.timeout(20000);
    await nodeOnlyAggregator.start();
    await nodeWithListProvider.start();
  });

  afterEach(async function () {
    this.timeout(20000);
    await nodeOnlyAggregator.stop();
    await nodeWithListProvider.stop();
  });

  it('Should start up a node with list provider', async () => {
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
  }).timeout(20000);

  it('Should start up a node with list provider using JSON-RPC in poi-node-request instead of REST', async () => {
    // JSON-RPC version of getNodeStatusAllNetworks
    const getNodeStatusAllNetworks_JSON_RPC_STUB = async (nodeURL: string) => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_node_status',
        params: {},
        id: '1',
      };

      const nodeStatusAllNetworks = await axios.post(
        `${nodeURL}/`, // JSON-RPC endpoint
        jsonRpcRequest,
      );

      console.log(
        'nodeStatusAllNetworks.data.result',
        await nodeStatusAllNetworks.data.result,
      );

      return nodeStatusAllNetworks.data.result;
    };

    // Create a stub for getNodeStatusAllNetworks
    const getNodeStatusAllNetworksStub = sinon
      .stub(POINodeRequest, 'getNodeStatusAllNetworks')
      .callsFake(getNodeStatusAllNetworks_JSON_RPC_STUB);

    // Check that the node is an instance of ProofOfInnocenceNode
    expect(nodeWithListProvider).to.be.an.instanceOf(ProofOfInnocenceNode);

    // Make sure it still successfully polls even with the stub
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

    getNodeStatusAllNetworksStub.restore();
  }).timeout(20000);

  it('Should start up a node with only aggregator', async () => {
    await nodeOnlyAggregator.start();
    await nodeOnlyAggregator.stop();
  }).timeout(10000);
});
