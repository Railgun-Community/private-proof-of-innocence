import { ProofOfInnocenceNode } from '../../proof-of-innocence-node';
import { LocalListProvider } from '../../local-list-provider';
import { MOCK_LIST_KEYS } from '../../tests/mocks.test';
import * as WalletModule from '../../engine/wallet';
import {
  BlindedCommitmentData,
  BlindedCommitmentType,
  GetMerkleProofsParams,
  GetPOIsPerListParams,
  NetworkName,
  NodeStatusAllNetworks,
  POIEventType,
  SingleCommitmentProofsData,
  SubmitLegacyTransactProofParams,
  SubmitTransactProofParams,
  TXIDVersion,
} from '@railgun-community/shared-models';
import axios, { AxiosError } from 'axios';
import 'dotenv/config';
import chai, { assert } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BlockedShieldsCache } from '../../shields/blocked-shields-cache';
import sinon, { SinonStub } from 'sinon';
import { QueryLimits } from '../../config/query-limits';
import { TransactProofMempool } from '../../proof-mempool/transact-proof-mempool';
import { RailgunTxidMerkletreeManager } from '../../railgun-txids/railgun-txid-merkletree-manager';
import { POIMerkletreeManager } from '../../poi-events/poi-merkletree-manager';
import { SignedPOIEvent } from '../../models/poi-types';
import { POIEventList } from '../../poi-events/poi-event-list';
import * as General from '../../config/general';
import { POINodeRequest } from '../poi-node-request';
import { API } from '../api';

chai.use(chaiAsPromised);
const { expect } = chai;

const listKey = MOCK_LIST_KEYS[0];

const txidVersion = TXIDVersion.V2_PoseidonMerkle;

const host = 'localhost';

let node3010: ProofOfInnocenceNode;
let node3011: ProofOfInnocenceNode;
let apiUrl: string;

let base64Credentials: string;

// SINON STUBS
let stubGetAllShields: SinonStub;
let submitProofStub: SinonStub;
let getMerkleProofsStub: SinonStub;
let verifySignatureAndUpdateValidatedRailgunTxidStatusStub: SinonStub;
let verifyAndAddSignedPOIEventsWithValidatedMerklerootsStub: SinonStub;
let isListProviderStub: SinonStub;
let nodeURLForListKeyStub: SinonStub;
let getNodeStatusAllNetworksStub: SinonStub;

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

  beforeEach(async function () {
    // SINON STUBS
    stubGetAllShields = sinon
      .stub(WalletModule, 'getNewShieldsFromWallet')
      .resolves([]);
    submitProofStub = sinon.stub(TransactProofMempool, 'submitProof');
    getMerkleProofsStub = sinon.stub(POIMerkletreeManager, 'getMerkleProofs');
    verifySignatureAndUpdateValidatedRailgunTxidStatusStub = sinon.stub(
      RailgunTxidMerkletreeManager,
      'verifySignatureAndUpdateValidatedRailgunTxidStatus',
    );
    verifyAndAddSignedPOIEventsWithValidatedMerklerootsStub = sinon.stub(
      POIEventList,
      'verifyAndAddSignedPOIEventsWithValidatedMerkleroots',
    );
    isListProviderStub = sinon.stub(General, 'isListProvider');
    nodeURLForListKeyStub = sinon.stub(General, 'nodeURLForListKey');
    getNodeStatusAllNetworksStub = sinon.stub(
      POINodeRequest,
      'getNodeStatusAllNetworks',
    );
  });

  afterEach(async function () {
    stubGetAllShields.restore();
    submitProofStub.restore();
    getMerkleProofsStub.restore();
    verifySignatureAndUpdateValidatedRailgunTxidStatusStub.restore();
    verifyAndAddSignedPOIEventsWithValidatedMerklerootsStub.restore();
    isListProviderStub.restore();
    nodeURLForListKeyStub.restore();
    getNodeStatusAllNetworksStub.restore();
  });

  after(async function () {
    await node3010.stop();
    await node3011.stop();
  });

  it('Should throw an error if serve is called twice', () => {
    const api = new API([listKey]);
    api.serve('localhost', '3011'); // First call to serve

    try {
      api.serve('localhost', '3011'); // Second call to serve
      assert.fail('Expected serve to throw an error, but it did not');
    } catch (err) {
      assert.equal(err.message, 'API is already running.');
    }
  });

  it('Should return status ok for GET /', async () => {
    const response = await axios.get(`${apiUrl}/`);

    expect(response.status).to.equal(200);
    expect(response.data).to.deep.equal({ status: 'ok' });
  }).timeout(10000);

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

  it('Should return 401 for GET /perf with missing auth', async () => {
    await expect(axios.get(`${apiUrl}/perf`)).to.eventually.be.rejectedWith(
      'Request failed with status code 401',
    );
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

  it('Should return 200 for POST /node-status-v2/:listKey', async () => {
    // Stub nodeURLForListKey with the aggregator key
    nodeURLForListKeyStub.returns('http://localhost:3011');

    const response = await axios.get(`${apiUrl}/node-status-v2/${listKey}`);

    expect(response.status).to.equal(200);
  });

  it('Should return 500 for POST /node-status-v2/:listKey with undefined listKey', async () => {
    await expect(
      axios.get(`${apiUrl}/node-status-v2/${listKey}`),
    ).to.eventually.be.rejectedWith('Request failed with status code 500');
  });

  it('Should return 200 for POST /poi-events', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;

    const response = await AxiosTest.postRequest(
      `${apiUrl}/poi-events/${chainType}/${chainID}`,
      { txidVersion, listKey, startIndex: 0, endIndex: 1 },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /poi-events with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';

    await expect(
      AxiosTest.postRequest(`${apiUrl}/poi-events/${chainType}/${chainID}`, {
        startIndex: 0,
        endIndex: 1,
      }),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: must have required property 'txidVersion'`,
    );
  });

  it('Should return 400 for POST /poi-events with invalid listKey', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;

    // Stub isListProvider to get full error message as an aggregator
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(`${apiUrl}/poi-events/${chainType}/${chainID}`, {
        txidVersion,
        listKey: 'fake_list_key',
        startIndex: 0,
        endIndex: 1,
      }),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: Invalid listKey`,
    );
  });

  it('Should return 400 for POST /poi-events with rangeLength > MAX_EVENT_QUERY_RANGE_LENGTH', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;

    // Stub isListProvider to get full error message as an aggregator
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(`${apiUrl}/poi-events/${chainType}/${chainID}`, {
        txidVersion,
        listKey,
        startIndex: 0,
        endIndex: QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH + 1,
      }),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: Max event query range length is ${QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH}`,
    );
  });

  it('Should return 400 for POST /poi-events with rangeLength < 0', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;

    // Stub isListProvider to get full error message as an aggregator
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(`${apiUrl}/poi-events/${chainType}/${chainID}`, {
        txidVersion,
        listKey,
        startIndex: 1,
        endIndex: 0,
      }),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: Invalid query range`,
    );
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

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/transact-proofs/${chainType}/${chainID}`,
        { bloomFilterSerialized: 'someValidSerializedData', listKey },
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: must have required property 'txidVersion'`,
    );
  });

  it('Should return 400 for POST /transact-proofs with Invalid listKey', async () => {
    const chainType = '0';
    const chainID = '5';

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/transact-proofs/${chainType}/${chainID}`,
        {
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          bloomFilterSerialized: 'someValidSerializedData',
          listKey: 'fake_list_key',
        },
      ),
    ).to.eventually.be.rejectedWith(
      'Request failed with status code 400: Invalid listKey',
    );
  });

  it('Should return 200 for POST /blocked-shields', async () => {
    const chainType = '0';
    const chainID = '5';
    const bloomFilterSerialized = BlockedShieldsCache.serializeBloomFilter(
      listKey,
      NetworkName.EthereumGoerli_DEPRECATED,
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

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/blocked-shields/${chainType}/${chainID}`,
        { bloomFilterSerialized: 0, listKey },
      ),
    ).to.be.rejectedWith(
      `Request failed with status code 400: must have required property 'txidVersion'`,
    );
  });

  it('Should return 400 for POST /blocked-shields with Invalid listKey', async () => {
    const chainType = '0';
    const chainID = '5';

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/blocked-shields/${chainType}/${chainID}`,
        {
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          bloomFilterSerialized: BlockedShieldsCache.serializeBloomFilter(
            'fake_list_key',
            NetworkName.EthereumGoerli_DEPRECATED,
            TXIDVersion.V2_PoseidonMerkle,
          ),
          listKey: 'fake_list_key',
        },
      ),
    ).to.be.rejectedWith(
      'Request failed with status code 400: Invalid listKey',
    );
  });

  it('Should return 200 for POST /submit-transact-proof', async () => {
    const chainType = '0';
    const chainID = '5';

    const body: SubmitTransactProofParams = {
      chainType,
      chainID,
      txidVersion: TXIDVersion.V2_PoseidonMerkle,
      listKey: listKey,
      transactProofData: {
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
        txidMerklerootIndex: 0,
        blindedCommitmentsOut: [
          '0x1441c994c1336075c8fc3687235e583fb5fa37e561184585bac31e3c029a46eb',
          '0x19f596cb35c783ce81498026696fae8f84de0937f68354ef29a08bf8c01e3f38',
        ],
        railgunTxidIfHasUnshield:
          '0x0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62',
      },
    };

    // Stub the submitProof function used in the api call as an async function
    submitProofStub.callsFake(async () => {});

    const response = await AxiosTest.postRequest(
      `${apiUrl}/submit-transact-proof/${chainType}/${chainID}`,
      body,
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /submit-transact-proof with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/submit-transact-proof/${chainType}/${chainID}`,
        { listKey, transactProofData: 0 },
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: must have required property 'txidVersion'`,
    );
  });

  it('Should return 400 for POST /submit-transact-proof with Invalid listKey', async () => {
    const chainType = '0';
    const chainID = '5';

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    const body: SubmitTransactProofParams = {
      chainType,
      chainID,
      txidVersion: TXIDVersion.V2_PoseidonMerkle,
      listKey: 'fake_list_key',
      transactProofData: {
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
        txidMerklerootIndex: 0,
        blindedCommitmentsOut: [
          '0x1441c994c1336075c8fc3687235e583fb5fa37e561184585bac31e3c029a46eb',
          '0x19f596cb35c783ce81498026696fae8f84de0937f68354ef29a08bf8c01e3f38',
        ],
        railgunTxidIfHasUnshield:
          '0x0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62',
      },
    };

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/submit-transact-proof/${chainType}/${chainID}`,
        body,
      ),
    ).to.be.rejectedWith(
      'Request failed with status code 400: Invalid listKey',
    );
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

  it('Should return 400 for POST /submit-single-commitment-proofs with invalid body', async () => {
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

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(`${apiUrl}/pois-per-list/${chainType}/${chainID}`, {
        listKey: 0,
        blindedCommitmentDatas: 0,
      }),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: must have required property 'txidVersion'`,
    );
  });

  it('Should return `Too many blinded commitments` for POST /pois-per-list', async () => {
    const chainType = '0';
    const chainID = '5';

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    // Create array with 1000 blinded commitments
    const blindedCommitmentDatas: BlindedCommitmentData[] = Array.from(
      { length: QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS + 1 },
      () => ({
        blindedCommitment: '',
        type: BlindedCommitmentType.Transact,
      }),
    );

    const body: GetPOIsPerListParams = {
      chainType,
      chainID,
      txidVersion,
      listKeys: [listKey],
      blindedCommitmentDatas: blindedCommitmentDatas,
    };

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/pois-per-list/${chainType}/${chainID}`,
        body,
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: Too many blinded commitments`,
    );
  });

  it('Should return 200 for POST /merkle-proofs', async () => {
    const chainType = '0';
    const chainID = '5';

    const body: GetMerkleProofsParams = {
      chainType,
      chainID,
      txidVersion: TXIDVersion.V2_PoseidonMerkle,
      listKey: listKey,
      blindedCommitments: ['', ''],
    };

    // Stub the getMerkleProofs function used in the api call as an async function
    getMerkleProofsStub.callsFake(async () => {
      const dummyMerkleProof = {
        leaf: '',
        elements: [],
        indices: '',
        root: '',
      };
      return [dummyMerkleProof];
    });

    const response = await AxiosTest.postRequest(
      `${apiUrl}/merkle-proofs/${chainType}/${chainID}`,
      body,
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /merkle-proofs with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(`${apiUrl}/merkle-proofs/${chainType}/${chainID}`, {
        listKey,
        blindedCommitments: 0,
      }),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: must have required property 'txidVersion'`,
    );
  });

  it('Should return 400 for POST /merkle-proofs with invalid listKey', async () => {
    const chainType = '0';
    const chainID = '5';

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    const body: GetMerkleProofsParams = {
      chainType,
      chainID,
      txidVersion: TXIDVersion.V2_PoseidonMerkle,
      listKey: 'fake_list_key',
      blindedCommitments: ['', ''],
    };

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/merkle-proofs/${chainType}/${chainID}`,
        body,
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: Invalid listKey`,
    );
  });

  it('Should return 400 for POST /merkle-proofs with blindedCommitments.length > QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS', async () => {
    const chainType = '0';
    const chainID = '5';

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    const body: GetMerkleProofsParams = {
      chainType,
      chainID,
      txidVersion: TXIDVersion.V2_PoseidonMerkle,
      listKey: listKey,
      blindedCommitments: Array.from(
        { length: QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS + 1 },
        () => '',
      ),
    };

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/merkle-proofs/${chainType}/${chainID}`,
        body,
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: Too many blinded commitments`,
    );
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

  it('Should submit legacy transact proofs', async () => {
    const chainType = '0';
    const chainID = '5';

    const body: SubmitLegacyTransactProofParams = {
      chainType,
      chainID,
      txidVersion: TXIDVersion.V2_PoseidonMerkle,
      listKeys: ['test_list'],
      legacyTransactProofDatas: [
        {
          txidIndex: '0',
          npk: '0x0630ebf7bb25061ed25456a453912fd502a5b8ebc19ca3f8b88cb51ef6b88c92',
          value: '0',
          tokenHash: '0x00',
          blindedCommitment: '',
        },
      ],
    };

    const response = await AxiosTest.postRequest(
      `${apiUrl}/submit-legacy-transact-proofs/${chainType}/${chainID}`,
      body,
    );

    expect(response.status).to.equal(200);
  });

  it('Should remove a transact proof', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
    const blindedCommitmentsOut = [
      '0x1441c994c1336075c8fc3687235e583fb5fa37e561184585bac31e3c029a46eb',
      '0x19f596cb35c783ce81498026696fae8f84de0937f68354ef29a08bf8c01e3f38',
    ];
    const railgunTxidIfHasUnshield =
      '0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62';
    const signature = '0x00';

    // Remove the proof
    const response = await AxiosTest.postRequest(
      `${apiUrl}/remove-transact-proof/${chainType}/${chainID}`,
      {
        txidVersion,
        listKey,
        blindedCommitmentsOut,
        railgunTxidIfHasUnshield,
        signature,
      },
    );

    expect(response.status).to.equal(200);
  });

  it('Should fail to remove a transact proof with an unsaved list key', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
    const listKey = 'fake_list_key';
    const blindedCommitmentsOut = [
      '0x1441c994c1336075c8fc3687235e583fb5fa37e561184585bac31e3c029a46eb',
      '0x19f596cb35c783ce81498026696fae8f84de0937f68354ef29a08bf8c01e3f38',
    ];
    const railgunTxidIfHasUnshield =
      '0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62';
    const signature = '0x00';

    // Remove the proof
    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/remove-transact-proof/${chainType}/${chainID}`,
        {
          txidVersion,
          listKey,
          blindedCommitmentsOut,
          railgunTxidIfHasUnshield,
          signature,
        },
      ),
    ).to.be.rejectedWith('Request failed with status code 400');
  });

  it('Should return 200 for POST /submit-validated-txid', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
    const txidIndex = 0;
    const merkleroot = '';
    const signature = '0x00';

    const response = await AxiosTest.postRequest(
      `${apiUrl}/submit-validated-txid/${chainType}/${chainID}`,
      { txidVersion, txidIndex, merkleroot, signature, listKey },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /submit-validated-txid with Invalid listKey', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
    const txidIndex = 0;
    const merkleroot = '';
    const signature = '0x00';

    // Stub the verifySignatureAndUpdateValidatedRailgunTxidStatus function used in the api call as an async function
    verifySignatureAndUpdateValidatedRailgunTxidStatusStub.callsFake(
      async () => {},
    );

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/submit-validated-txid/${chainType}/${chainID}`,
        {
          txidVersion,
          txidIndex,
          merkleroot,
          signature,
          listKey: 'fake_list_key',
        },
      ),
    ).to.be.rejectedWith(
      'Request failed with status code 400: Invalid listKey',
    );
  });

  it('Should return 200 for POST /pois-per-blinded-commitment', async () => {
    const chainType = '0';
    const chainID = '5';
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
      `${apiUrl}/pois-per-blinded-commitment/${chainType}/${chainID}`,
      { txidVersion, listKey, blindedCommitmentDatas },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /pois-per-blinded-commitment with too many blinded commitments', async () => {
    const chainType = '0';
    const chainID = '5';
    const blindedCommitmentDatas: BlindedCommitmentData[] = Array.from(
      { length: QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS + 1 },
      () => ({
        blindedCommitment: '',
        type: BlindedCommitmentType.Transact,
      }),
    );

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/pois-per-blinded-commitment/${chainType}/${chainID}`,
        { txidVersion, listKey, blindedCommitmentDatas },
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: Too many blinded commitments`,
    );
  });

  it('Should return 200 for POST /submit-poi-event', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
    const signedPOIEvent: SignedPOIEvent = {
      index: 0,
      blindedCommitment: '',
      signature: '',
      type: POIEventType.Transact,
    };
    const validatedMerkleroot = '';

    // Stub verifyAndAddSignedPOIEventsWithValidatedMerkleroots function used in the api call as an async function
    verifyAndAddSignedPOIEventsWithValidatedMerklerootsStub.callsFake(
      async () => {},
    );

    const response = await AxiosTest.postRequest(
      `${apiUrl}/submit-poi-event/${chainType}/${chainID}`,
      { txidVersion, listKey, signedPOIEvent, validatedMerkleroot },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /submit-poi-event with Invalid listKey', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
    const signedPOIEvent: SignedPOIEvent = {
      index: 0,
      blindedCommitment: '',
      signature: '',
      type: POIEventType.Transact,
    };
    const validatedMerkleroot = '';

    // Stub the isListProvider function to fake being an aggregator so error message is returned
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/submit-poi-event/${chainType}/${chainID}`,
        {
          txidVersion,
          listKey: 'fake_list_key',
          signedPOIEvent,
          validatedMerkleroot,
        },
      ),
    ).to.be.rejectedWith(
      'Request failed with status code 400: Invalid listKey',
    );
  });

  it('Should return 200 for POST /legacy-transact-proofs', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
    const bloomFilterSerialized = BlockedShieldsCache.serializeBloomFilter(
      listKey,
      NetworkName.EthereumGoerli_DEPRECATED,
      txidVersion,
    );

    const response = await AxiosTest.postRequest(
      `${apiUrl}/legacy-transact-proofs/${chainType}/${chainID}`,
      { txidVersion, bloomFilterSerialized },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /legacy-transact-proofs with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/legacy-transact-proofs/${chainType}/${chainID}`,
        { bloomFilterSerialized: 0 },
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: must have required property 'txidVersion'`,
    );
  });

  it('Should return 200 for POST /poi-merkletree-leaves', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;

    const response = await AxiosTest.postRequest(
      `${apiUrl}/poi-merkletree-leaves/${chainType}/${chainID}`,
      { txidVersion, listKey, startIndex: 0, endIndex: 1 },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 400 for POST /poi-merkletree-leaves with invalid body', async () => {
    const chainType = '0';
    const chainID = '5';

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/poi-merkletree-leaves/${chainType}/${chainID}`,
        {
          startIndex: 0,
          endIndex: 1,
        },
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: must have required property 'txidVersion'`,
    );
  });

  it('Should return 400 for POST /poi-merkletree-leaves with invalid listKey', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;

    // Stub isListProvider to get full error message as an aggregator
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/poi-merkletree-leaves/${chainType}/${chainID}`,
        {
          txidVersion,
          listKey: 'fake_list_key',
          startIndex: 0,
          endIndex: 1,
        },
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: Invalid listKey`,
    );
  }).timeout(10000);

  it('Should return 400 for POST /poi-merkletree-leaves with rangeLength > MAX_POI_MERKLETREE_LEAVES_QUERY_RANGE_LENGTH', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;

    // Stub isListProvider to get full error message as an aggregator
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/poi-merkletree-leaves/${chainType}/${chainID}`,
        {
          txidVersion,
          listKey,
          startIndex: 0,
          endIndex:
            QueryLimits.MAX_POI_MERKLETREE_LEAVES_QUERY_RANGE_LENGTH + 1,
        },
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: Max event query range length is ${QueryLimits.MAX_POI_MERKLETREE_LEAVES_QUERY_RANGE_LENGTH}`,
    );
  });

  it('Should return 400 for POST /poi-merkletree-leaves with rangeLength < 0', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;

    // Stub isListProvider to get full error message as an aggregator
    isListProviderStub.callsFake(() => true);

    await expect(
      AxiosTest.postRequest(
        `${apiUrl}/poi-merkletree-leaves/${chainType}/${chainID}`,
        {
          txidVersion,
          listKey,
          startIndex: 1,
          endIndex: 0,
        },
      ),
    ).to.eventually.be.rejectedWith(
      `Request failed with status code 400: Invalid query range`,
    );
  });

  it('Should return 200 for POST /validated-txid/:chainType/:chainID', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;

    const response = await AxiosTest.postRequest(
      `${apiUrl}/validated-txid/${chainType}/${chainID}`,
      { txidVersion },
    );

    expect(response.status).to.equal(200);
  });

  it('Should return 200 for POST /validate-poi-merkleroots/:chainType/:chainID', async () => {
    const chainType = '0';
    const chainID = '5';
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;

    const response = await AxiosTest.postRequest(
      `${apiUrl}/validate-poi-merkleroots/${chainType}/${chainID}`,
      { txidVersion, listKey, poiMerkleroots: [''] },
    );

    expect(response.status).to.equal(200);
  });
});
