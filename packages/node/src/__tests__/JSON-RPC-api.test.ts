import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import axios, { AxiosError } from 'axios';
import { TXIDVersion } from '@railgun-community/shared-models';
import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { MOCK_LIST_KEYS } from '../tests/mocks.test';
import { LocalListProvider } from '../local-list-provider';

chai.use(chaiAsPromised);
const { expect } = chai;

const listKey = MOCK_LIST_KEYS[0];

const txidVersion = TXIDVersion.V2_PoseidonMerkle;

const host = 'localhost';

let node3010: ProofOfInnocenceNode;
let node3011: ProofOfInnocenceNode;
let apiUrl: string;

let base64Credentials: string;

class AxiosTest {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async getRequest(url: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return await axios.get(url);
    } catch (err) {
      if (!(err instanceof AxiosError)) {
        throw err;
      }
      const errMessage = err.message;
      throw new Error(errMessage);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static async postRequest(url: string, params: object) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return await axios.post(url, params);
    } catch (err) {
      if (!(err instanceof AxiosError)) {
        throw err;
      }
      const errMessage = `${err.message}: ${err.response?.data}`;
      throw new Error(errMessage);
    }
  }
}

describe('JSON RPC API Tests', function () {
  before(async function () {
    this.timeout(40000);

    const listProvider = new LocalListProvider(listKey);

    node3011 = new ProofOfInnocenceNode(host, '3011', [], listProvider);
    await node3011.start();

    node3010 = new ProofOfInnocenceNode(
      host,
      '3010',
      [{ name: 'test-1', nodeURL: 'http://localhost:3011', listKey }],
      listProvider,
    );
    await node3010.start();

    apiUrl = node3011.getURL();

    // Import admin and password from .env file
    const username = process.env.BASIC_AUTH_USERNAME;
    const password = process.env.BASIC_AUTH_PASSWORD;
    base64Credentials = Buffer.from(
      `${username}:${password}`,
      'utf-8',
    ).toString('base64');
  });

  after(async function () {
    await node3010.stop();
    await node3011.stop();
  });

  // TODO: Add beforeEach and afterEach for sinon if needed

  it('Should return status ok for GET /', async () => {
    const response = await axios.get(`${apiUrl}/`);

    expect(response.status).to.equal(200);
    expect(response.data).to.deep.equal({ status: 'ok' });
  }).timeout(10000);

  it.only(
    'Should return node status for JSON RPC method ppoi_node-status-v2',
    async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_node-status-v2',
        params: {},
        id: 1,
      };

      console.log(
        'Calling API at: ',
        apiUrl,
        ' with request: ',
        jsonRpcRequest,
      );

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      const body = response.data.result; // Access the result field for JSON RPC response

      expect(response.status).to.equal(200);
      expect(body).to.have.keys(['listKeys', 'forNetwork']);
    },
  ).timeout(10000);
});
