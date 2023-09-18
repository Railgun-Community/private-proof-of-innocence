import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { LocalListProvider } from '../local-list-provider';
import supertest, { Response } from 'supertest';
import { expect } from 'chai';
import { MOCK_LIST_KEYS } from '../tests/mocks.test';
import { NodeStatusAllNetworks } from '@railgun-community/shared-models';

const listKey = MOCK_LIST_KEYS[0];

describe('api', function () {
  let node3010: ProofOfInnocenceNode;
  let node3011: ProofOfInnocenceNode;
  let request: supertest.SuperTest<supertest.Test>;

  // Start services before all tests
  before(async function () {
    this.timeout(30000);

    const listProvider = new LocalListProvider(listKey);

    const host = '0.0.0.0';

    node3011 = new ProofOfInnocenceNode(host, '3011', [], listProvider);
    await node3011.start();

    node3010 = new ProofOfInnocenceNode(
      host,
      '3010',
      ['http://localhost:3011'],
      listProvider,
    );
    await node3010.start();

    request = supertest(`http://${host}:3010`);
  });

  after(async function () {
    await node3010.stop();
    await node3011.stop();
  });

  it('Should return status ok for root route', async () => {
    const response: Response = await request.get('/');

    expect(response.status).to.equal(200);
    expect(response.body).to.deep.equal({ status: 'ok' });
  });

  it('Should return performance metrics for /perf', async () => {
    const response = await request.get('/perf');

    expect(response.status).to.equal(200);
    expect(response.body).to.have.keys([
      'time',
      'memoryUsage',
      'freemem',
      'loadavg',
    ]);
  });

  it('Should return node status for /node-status', async () => {
    const response: Response = await request.get('/node-status');
    const body = response.body as NodeStatusAllNetworks;

    expect(response.status).to.equal(200);
    expect(body).to.have.keys(['listKeys', 'forNetwork']);
    expect(body.forNetwork).to.have.keys(['Ethereum', 'Ethereum_Goerli']);
    expect(body.forNetwork.Ethereum).to.have.keys([
      'txidStatus',
      'eventListStatuses',
    ]);

    if (body.forNetwork.Ethereum) {
      expect(body.forNetwork.Ethereum.txidStatus).to.haveOwnProperty(
        'currentTxidIndex',
      );
      expect(body.forNetwork.Ethereum.txidStatus).to.haveOwnProperty(
        'currentMerkleroot',
      );
    }

    if (body.forNetwork.Ethereum_Goerli) {
      expect(body.forNetwork.Ethereum_Goerli.txidStatus).to.haveOwnProperty(
        'currentTxidIndex',
      );
      expect(body.forNetwork.Ethereum_Goerli.txidStatus).to.haveOwnProperty(
        'currentMerkleroot',
      );
    }
  });
});
