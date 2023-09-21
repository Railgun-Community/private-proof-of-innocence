import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { LocalListProvider } from '../local-list-provider';
import { expect } from 'chai';
import { MOCK_LIST_KEYS } from '../tests/mocks.test';
import {
  BlindedCommitmentData,
  BlindedCommitmentType,
  NodeStatusAllNetworks,
  TransactProofData,
} from '@railgun-community/shared-models';
import axios, { AxiosError, AxiosResponse } from 'axios';
import 'dotenv/config';

const listKey = MOCK_LIST_KEYS[0];

// Import admin and password from .env file
const username = process.env.BASIC_AUTH_USERNAME;
const password = process.env.BASIC_AUTH_PASSWORD;
const base64Credentials = Buffer.from(`${username}:${password}`).toString(
  'base64',
);

describe.only('api', function () {
  let node3010: ProofOfInnocenceNode;
  let node3011: ProofOfInnocenceNode;
  let apiUrl: string;

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

    apiUrl = `http://${host}:3010`;
  });

  after(async function () {
    await node3010.stop();
    await node3011.stop();
  });

  it('Should return status ok for GET /', async () => {
    const response = await axios.get(`${apiUrl}/`);

    expect(response.status).to.equal(200);
    expect(response.data).to.deep.equal({ status: 'ok' });
  });

  it('Should return 200 for GET /perf', async () => {
    const response = await axios.get(`${apiUrl}/perf`, {
      headers: {
        Authorization: `Basic ${base64Credentials}`,
      },
    });

    expect(response.status).to.equal(200);
    expect(response.data).to.have.keys([
      'time',
      'memoryUsage',
      'freemem',
      'loadavg',
    ]);
  });

  it('Should return 401 for GET /perf with invalid auth', async () => {
    let errorResponse: AxiosResponse | undefined;

    const badCredentials = Buffer.from('admin:wrongpassword').toString(
      'base64',
    );

    try {
      await axios.get(`${apiUrl}/perf`, {
        headers: {
          Authorization: `Basic ${badCredentials}`,
        },
      });
    } catch (err) {
      const error = err as AxiosError;
      errorResponse = error.response;
    }

    if (errorResponse) {
      expect(errorResponse.status).to.equal(401);
    } else {
      throw new Error('Expected errorResponse to be defined');
    }
  });

  it('Should return node status for GET /node-status', async () => {
    const response = await axios.get(`${apiUrl}/node-status`);
    const body = response.data as unknown as NodeStatusAllNetworks;

    expect(response.status).to.equal(200);
    expect(body).to.have.keys(['listKeys', 'forNetwork']);
    expect(body.forNetwork).to.have.keys(['Ethereum', 'Ethereum_Goerli']);
    expect(body.forNetwork.Ethereum).to.have.keys([
      'txidStatus',
      'listStatuses',
      'shieldQueueStatus',
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
  }).timeout(5000); // Test seems to always take > 2000ms

  it('Should return 200 for POST /transact-proofs with valid auth', async () => {
    const chainType = '0';
    const chainID = '5';
    const validBloomFilterSerialized = 'someValidSerializedData';

    const response = await axios.post(
      `${apiUrl}/transact-proofs/${chainType}/${chainID}/${listKey}`,
      { bloomFilterSerialized: validBloomFilterSerialized },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /transact-proofs with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';
    let errorResponse: AxiosResponse | undefined;

    try {
      await axios.post(
        `${apiUrl}/transact-proofs/${chainType}/${chainID}/${listKey}`,
        { bloomFilterSerialized: 0 },
        {
          headers: {
            Authorization: `Basic ${base64Credentials}`,
          },
        },
      );
    } catch (err) {
      const error = err as AxiosError;
      errorResponse = error.response;
    }

    if (errorResponse) {
      expect(errorResponse.status).to.equal(400);
    } else {
      throw new Error('Expected errorResponse to be defined');
    }
  });

  it('Should return 200 for POST /blocked-shields', async () => {
    const chainType = '0';
    const chainID = '5';
    const bloomFilterSerialized = 'someValidSerializedData';

    const response = await axios.post(
      `${apiUrl}/blocked-shields/${chainType}/${chainID}/${listKey}`,
      { bloomFilterSerialized },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /blocked-shields with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';
    let errorResponse: AxiosResponse | undefined;

    try {
      await axios.post(
        `${apiUrl}/blocked-shields/${chainType}/${chainID}/${listKey}`,
        { bloomFilterSerialized: 0 },
        {
          headers: {
            Authorization: `Basic ${base64Credentials}`,
          },
        },
      );
    } catch (err) {
      const error = err as AxiosError;
      errorResponse = error.response;
    }

    if (errorResponse) {
      expect(errorResponse.status).to.equal(400);
    } else {
      throw new Error('Expected errorResponse to be defined');
    }
  });

  it.skip('Should return 200 for POST /submit-transact-proof', async () => {
    // TODO No POI node for blinded commitment (node hash) using fake data
    const chainType = '0';
    const chainID = '5';

    const transactProofData: TransactProofData = {
      // Make sure to have no empty strings in snarkProof
      snarkProof: {
        pi_a: ['some_string', 'some_string'],
        pi_b: [
          ['some_string', 'some_string'],
          ['some_string', 'some_string'],
        ],
        pi_c: ['some_string', 'some_string'],
      },
      poiMerkleroots: ['', ''],
      txidMerkleroot: '',
      txidMerklerootIndex: 0,
      blindedCommitmentOutputs: ['', ''],
    };

    const response = await axios.post(
      `${apiUrl}/submit-transact-proof/${chainType}/${chainID}`,
      { listKey, transactProofData },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /submit-transact-proof with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';
    let errorResponse: AxiosResponse | undefined;

    try {
      await axios.post(
        `${apiUrl}/submit-transact-proof/${chainType}/${chainID}`,
        { listKey, transactProofData: 0 },
        {
          headers: {
            Authorization: `Basic ${base64Credentials}`,
          },
        },
      );
    } catch (err) {
      const error = err as AxiosError;
      errorResponse = error.response;
    }

    if (errorResponse) {
      expect(errorResponse.status).to.equal(400);
    } else {
      throw new Error('Expected errorResponse to be defined');
    }
  });

  it('Should return 200 for POST /pois-per-list', async () => {
    const chainType = '0';
    const chainID = '5';
    const listKeys = [listKey];

    const blindedCommitmentDatas: BlindedCommitmentData[] = [
      {
        blindedCommitment: '',
        type: BlindedCommitmentType.Transact,
      },
      {
        blindedCommitment: '',
        type: BlindedCommitmentType.Shield,
      },
    ];

    const response = await axios.post(
      `${apiUrl}/pois-per-list/${chainType}/${chainID}`,
      { listKeys, blindedCommitmentDatas },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /pois-per-list with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';
    let errorResponse: AxiosResponse | undefined;

    try {
      await axios.post(
        `${apiUrl}/pois-per-list/${chainType}/${chainID}`,
        { listKey: 0, blindedCommitmentDatas: 0 },
        {
          headers: {
            Authorization: `Basic ${base64Credentials}`,
          },
        },
      );
    } catch (err) {
      const error = err as AxiosError;
      errorResponse = error.response;
    }

    if (errorResponse) {
      expect(errorResponse.status).to.equal(400);
    } else {
      throw new Error('Expected errorResponse to be defined');
    }
  });

  it.skip('Should return 200 for POST /merkle-proofs', async () => {
    // TODO: proof can't be verified because of fake data
    const chainType = '0';
    const chainID = '5';
    const blindedCommitments = ['', ''];

    const response = await axios.post(
      `${apiUrl}/merkle-proofs/${chainType}/${chainID}`,
      { listKey, blindedCommitments },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /merkle-proofs with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';
    let errorResponse: AxiosResponse | undefined;

    try {
      await axios.post(
        `${apiUrl}/merkle-proofs/${chainType}/${chainID}`,
        { listKey, blindedCommitments: 0 },
        {
          headers: {
            Authorization: `Basic ${base64Credentials}`,
          },
        },
      );
    } catch (err) {
      const error = err as AxiosError;
      errorResponse = error.response;
    }

    if (errorResponse) {
      expect(errorResponse.status).to.equal(400);
    } else {
      throw new Error('Expected errorResponse to be defined');
    }
  });

  it('Should return 200 for POST /validate-txid-merkleroot', async () => {
    const chainType = '0';
    const chainID = '5';
    const tree = 0;
    const index = 0;
    const merkleroot = '';

    const response = await axios.post(
      `${apiUrl}/validate-txid-merkleroot/${chainType}/${chainID}`,
      { tree, index, merkleroot },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /validate-txid-merkleroot with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';
    let errorResponse: AxiosResponse | undefined;

    try {
      await axios.post(
        `${apiUrl}/validate-txid-merkleroot/${chainType}/${chainID}`,
        { tree: 0, index: 0, merkleroot: 0 },
        {
          headers: {
            Authorization: `Basic ${base64Credentials}`,
          },
        },
      );
    } catch (err) {
      const error = err as AxiosError;
      errorResponse = error.response;
    }

    if (errorResponse) {
      expect(errorResponse.status).to.equal(400);
    } else {
      throw new Error('Expected errorResponse to be defined');
    }
  });
});
