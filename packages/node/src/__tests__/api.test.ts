import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { LocalListProvider } from '../local-list-provider';
import { MOCK_LIST_KEYS } from '../tests/mocks.test';
import * as WalletModule from '../engine/wallet';
import {
  BlindedCommitmentData,
  BlindedCommitmentType,
  NetworkName,
  NodeStatusAllNetworks,
  SingleCommitmentProofsData,
  TXIDVersion,
  TransactProofData,
} from '@railgun-community/shared-models';
import axios, { AxiosError } from 'axios';
import 'dotenv/config';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BlockedShieldsCache } from '../shields/blocked-shields-cache';
import sinon from 'sinon';

chai.use(chaiAsPromised);
const { expect } = chai;

const listKey = MOCK_LIST_KEYS[0];

const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let node3010: ProofOfInnocenceNode;
let node3011: ProofOfInnocenceNode;
let apiUrl: string;

let base64Credentials: string;

let stubGetAllShields: sinon.SinonStub;

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

describe('api', function () {
  before(async function () {
    this.timeout(30000);

    const listProvider = new LocalListProvider(listKey);

    const host = 'localhost';

    stubGetAllShields = sinon
      .stub(WalletModule, 'getNewShieldsFromWallet')
      .resolves([]);

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
    stubGetAllShields?.restore();
    await node3010.stop();
    await node3011.stop();
  });

  it('Should return status ok for GET /', async () => {
    const response = await axios.get(`${apiUrl}/`);

    expect(response.status).to.equal(200);
    expect(response.data).to.deep.equal({ status: 'ok' });
  }).timeout(2000);

  it('Should return 200 for GET /perf with valid credentials', async () => {
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
    const badCredentials = Buffer.from('admin:wrongpassword').toString(
      'base64',
    );

    await expect(
      axios.get(`${apiUrl}/perf`, {
        headers: {
          Authorization: `Basic ${badCredentials}`,
        },
      }),
    ).to.eventually.be.rejectedWith('Request failed with status code 401');
  });

  it('Should return node status for GET /node-status-v2', async () => {
    const response = await axios.get(`${apiUrl}/node-status-v2`);
    const body = response.data as unknown as NodeStatusAllNetworks;

    expect(response.status).to.equal(200);
    expect(body).to.have.keys(['listKeys', 'forNetwork']);
    expect(body.forNetwork).to.have.keys(['Ethereum_Goerli']);
    expect(body.forNetwork.Ethereum_Goerli).to.have.keys([
      'legacyTransactProofs',
      'txidStatus',
      'listStatuses',
      'shieldQueueStatus',
    ]);

    if (body.forNetwork.Ethereum_Goerli) {
      expect(body.forNetwork.Ethereum_Goerli.txidStatus).to.haveOwnProperty(
        'currentTxidIndex',
      );
      expect(body.forNetwork.Ethereum_Goerli.txidStatus).to.haveOwnProperty(
        'currentMerkleroot',
      );
    }
  });

  it('Should return 200 for POST /transact-proofs', async () => {
    const chainType = '0';
    const chainID = '5';
    const validBloomFilterSerialized = 'someValidSerializedData';

    const response = await AxiosTest.postRequest(
      `${apiUrl}/transact-proofs/${chainType}/${chainID}`,
      {
        txidVersion,
        bloomFilterSerialized: validBloomFilterSerialized,
        listKey,
      },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /transact-proofs with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/transact-proofs/${chainType}/${chainID}`,
        { bloomFilterSerialized: 0, listKey },
      ),
    ).to.eventually.be.rejectedWith('Request failed with status code 400');
  });

  it('Should return 200 for POST /blocked-shields', async () => {
    const chainType = '0';
    const chainID = '5';
    const bloomFilterSerialized = BlockedShieldsCache.serializeBloomFilter(
      listKey,
      NetworkName.EthereumGoerli,
      txidVersion,
    );

    const response = await AxiosTest.postRequest(
      `${apiUrl}/blocked-shields/${chainType}/${chainID}`,
      { txidVersion, bloomFilterSerialized, listKey },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /blocked-shields with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/blocked-shields/${chainType}/${chainID}`,
        { bloomFilterSerialized: 0, listKey },
      ),
    ).to.eventually.be.rejectedWith('Request failed with status code 400');
  });

  it.skip('Should return 200 for POST /submit-transact-proof', async () => {
    // TODO: No POI node for blinded commitment (node hash) using fake data
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
      blindedCommitmentsOut: ['', ''],
      railgunTxidIfHasUnshield: '0x00',
    };

    const response = await AxiosTest.postRequest(
      `${apiUrl}/submit-transact-proof/${chainType}/${chainID}`,
      { listKey, transactProofData },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 200 for POST /submit-single-commitment-proofs', async () => {
    const singleCommitmentProofsData: SingleCommitmentProofsData = {
      railgunTxid:
        '0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62',
      utxoTreeIn: 0,
      utxoTreeOut: 0,
      utxoPositionOut: 69,
      commitment:
        '0x2c5acad8f41f95a2795997353f6cdb0838493cd5604f8ddc1859a468233e15ac',
      npk: '0x0630ebf7bb25061ed25456a453912fd502a5b8ebc19ca3f8b88cb51ef6b88c92',
      pois: {
        test_list: {
          '136f24c883d58d7130d8e001a043bad3b2b09a36104bec5b6a0f8181b7d0fa70': {
            snarkProof: {
              pi_a: [
                '13766471856281251472923302905099603168301598594631438526482227084351434874784',
                '8588729525737659890182759996444901624839043933579336012761314740925805937052',
              ],
              pi_b: [
                [
                  '14369045691397547776662456281960288655359320266442203106166271127565009565977',
                  '13979602192554711032664475121727723415005805236727028063872064436784678703054',
                ],
                [
                  '19941723190973813766411664236004793025252825360816561816851087470547847175501',
                  '17786622999411477509388993850683907602108444106094119333080295444943292227976',
                ],
              ],
              pi_c: [
                '640379350533687394488172632727298795692314074384434085471944446397998938790',
                '20177179856562770201382212249372199931536044097005309916738846107336280050881',
              ],
            },
            txidMerkleroot:
              '171280a4deabf34cc6d73713225ece6565516313f4475a07177d0736e2b4eaa4',
            poiMerkleroots: [
              '284d03b4f4e545a9bf5259162f0d5103c1598c98217b84ec51589610d94f7071',
            ],
            blindedCommitmentsOut: [
              '0x1441c994c1336075c8fc3687235e583fb5fa37e561184585bac31e3c029a46eb',
              '0x19f596cb35c783ce81498026696fae8f84de0937f68354ef29a08bf8c01e3f38',
            ],
            railgunTxidIfHasUnshield:
              '0x0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62',
          },
        },
      },
    };

    const chainType = '0';
    const chainID = '5';

    const response = await AxiosTest.postRequest(
      `${apiUrl}/submit-single-commitment-proofs/${chainType}/${chainID}`,
      { txidVersion, singleCommitmentProofsData },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /submit-transact-proof with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/submit-transact-proof/${chainType}/${chainID}`,
        { listKey, transactProofData: 0 },
      ),
    ).to.eventually.be.rejectedWith('Request failed with status code 400');
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

    const response = await AxiosTest.postRequest(
      `${apiUrl}/pois-per-list/${chainType}/${chainID}`,
      { txidVersion, listKeys, blindedCommitmentDatas },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /pois-per-list with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';

    await expect(
      AxiosTest.postRequest(`${apiUrl}/pois-per-list/${chainType}/${chainID}`, {
        listKey: 0,
        blindedCommitmentDatas: 0,
      }),
    ).to.eventually.be.rejectedWith('Request failed with status code 400');
  });

  it.skip('Should return 200 for POST /merkle-proofs', async () => {
    // TODO: proof can't be verified because of fake data
    const chainType = '0';
    const chainID = '5';
    const blindedCommitments = ['', ''];

    const response = await AxiosTest.postRequest(
      `${apiUrl}/merkle-proofs/${chainType}/${chainID}`,
      { listKey, blindedCommitments },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /merkle-proofs with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';

    await expect(
      AxiosTest.postRequest(`${apiUrl}/merkle-proofs/${chainType}/${chainID}`, {
        listKey,
        blindedCommitments: 0,
      }),
    ).to.eventually.be.rejectedWith('Request failed with status code 400');
  });

  it('Should return 200 for POST /validate-txid-merkleroot', async () => {
    const chainType = '0';
    const chainID = '5';
    const tree = 0;
    const index = 0;
    const merkleroot = '';

    const response = await AxiosTest.postRequest(
      `${apiUrl}/validate-txid-merkleroot/${chainType}/${chainID}`,
      { txidVersion, tree, index, merkleroot },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /validate-txid-merkleroot with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/validate-txid-merkleroot/${chainType}/${chainID}`,
        { tree: 0, index: 0, merkleroot: 0 },
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: must have required property 'txidVersion'`,
    );
  });

  it('Should submit a single commitment proof', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
    const singleCommitmentProofsData: SingleCommitmentProofsData = {
      commitment:
        '0x2c5acad8f41f95a2795997353f6cdb0838493cd5604f8ddc1859a468233e15ac',
      npk: '0x0630ebf7bb25061ed25456a453912fd502a5b8ebc19ca3f8b88cb51ef6b88c92',
      utxoTreeIn: 0,
      utxoTreeOut: 0,
      utxoPositionOut: 69,
      railgunTxid:
        '0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62',
      pois: {
        listKey1: {
          txidLeafHash1: {
            snarkProof: {
              pi_a: [
                '13766471856281251472923302905099603168301598594631438526482227084351434874784',
                '8588729525737659890182759996444901624839043933579336012761314740925805937052',
              ],
              pi_b: [
                [
                  '14369045691397547776662456281960288655359320266442203106166271127565009565977',
                  '13979602192554711032664475121727723415005805236727028063872064436784678703054',
                ],
                [
                  '19941723190973813766411664236004793025252825360816561816851087470547847175501',
                  '17786622999411477509388993850683907602108444106094119333080295444943292227976',
                ],
              ],
              pi_c: [
                '640379350533687394488172632727298795692314074384434085471944446397998938790',
                '20177179856562770201382212249372199931536044097005309916738846107336280050881',
              ],
            },
            poiMerkleroots: [
              '284d03b4f4e545a9bf5259162f0d5103c1598c98217b84ec51589610d94f7071',
            ],
            txidMerkleroot:
              '171280a4deabf34cc6d73713225ece6565516313f4475a07177d0736e2b4eaa4',
            blindedCommitmentsOut: [
              '0x1441c994c1336075c8fc3687235e583fb5fa37e561184585bac31e3c029a46eb',
              '0x19f596cb35c783ce81498026696fae8f84de0937f68354ef29a08bf8c01e3f38',
            ],
            railgunTxidIfHasUnshield: '',
          },
          txidLeafHash2: {
            snarkProof: {
              pi_a: [
                '13766471856281251472923302905099603168301598594631438526482227084351434874784',
                '8588729525737659890182759996444901624839043933579336012761314740925805937052',
              ],
              pi_b: [
                [
                  '14369045691397547776662456281960288655359320266442203106166271127565009565977',
                  '13979602192554711032664475121727723415005805236727028063872064436784678703054',
                ],
                [
                  '19941723190973813766411664236004793025252825360816561816851087470547847175501',
                  '17786622999411477509388993850683907602108444106094119333080295444943292227976',
                ],
              ],
              pi_c: [
                '640379350533687394488172632727298795692314074384434085471944446397998938790',
                '20177179856562770201382212249372199931536044097005309916738846107336280050881',
              ],
            },
            poiMerkleroots: [
              '284d03b4f4e545a9bf5259162f0d5103c1598c98217b84ec51589610d94f7071',
            ],
            txidMerkleroot:
              '171280a4deabf34cc6d73713225ece6565516313f4475a07177d0736e2b4eaa4',
            blindedCommitmentsOut: [
              '0x1441c994c1336075c8fc3687235e583fb5fa37e561184585bac31e3c029a46eb',
              '0x19f596cb35c783ce81498026696fae8f84de0937f68354ef29a08bf8c01e3f38',
            ],
            railgunTxidIfHasUnshield: '',
          },
        },
        listKey2: {
          txidLeafHash3: {
            snarkProof: {
              pi_a: [
                '13766471856281251472923302905099603168301598594631438526482227084351434874784',
                '8588729525737659890182759996444901624839043933579336012761314740925805937052',
              ],
              pi_b: [
                [
                  '14369045691397547776662456281960288655359320266442203106166271127565009565977',
                  '13979602192554711032664475121727723415005805236727028063872064436784678703054',
                ],
                [
                  '19941723190973813766411664236004793025252825360816561816851087470547847175501',
                  '17786622999411477509388993850683907602108444106094119333080295444943292227976',
                ],
              ],
              pi_c: [
                '640379350533687394488172632727298795692314074384434085471944446397998938790',
                '20177179856562770201382212249372199931536044097005309916738846107336280050881',
              ],
            },
            poiMerkleroots: [
              '284d03b4f4e545a9bf5259162f0d5103c1598c98217b84ec51589610d94f7071',
            ],
            txidMerkleroot:
              '171280a4deabf34cc6d73713225ece6565516313f4475a07177d0736e2b4eaa4',
            blindedCommitmentsOut: [
              '0x1441c994c1336075c8fc3687235e583fb5fa37e561184585bac31e3c029a46eb',
              '0x19f596cb35c783ce81498026696fae8f84de0937f68354ef29a08bf8c01e3f38',
            ],
            railgunTxidIfHasUnshield: '',
          },
        },
      },
    };

    const response = await AxiosTest.postRequest(
      `${apiUrl}/submit-single-commitment-proofs/${chainType}/${chainID}`,
      { txidVersion, singleCommitmentProofsData },
    );

    expect(response.status).to.equal(200);
  });

  it('Should fail to submit a single commitment proof with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/submit-single-commitment-proofs/${chainType}/${chainID}`,
        { txidVersion, singleCommitmentProofsData: { invalidBody: 3000 } },
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: must have required property 'commitment'`,
    );
  });
});
