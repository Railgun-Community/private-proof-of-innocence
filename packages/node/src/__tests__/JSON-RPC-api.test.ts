/**
 * @dev This test suite is for testing the JSON RPC API of the node.
 * @note JSON-RPC handler is connected to POST `/` endpoint.
 */
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import axios, { AxiosError } from 'axios';
import {
  NetworkName,
  NodeStatusAllNetworks,
  TXIDVersion,
} from '@railgun-community/shared-models';
import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { MOCK_LIST_KEYS } from '../tests/mocks.test';
import { LocalListProvider } from '../local-list-provider';
import sinon, { SinonStub } from 'sinon';
import * as General from '../config/general';
import { QueryLimits } from '../config/query-limits';
import { BlockedShieldsCache } from '../shields/blocked-shields-cache';

interface ValidationError {
  params: {
    missingProperty: string;
    message: string;
  };
}

chai.use(chaiAsPromised);
const { expect } = chai;

const listKey = MOCK_LIST_KEYS[0];

const txidVersion = TXIDVersion.V2_PoseidonMerkle;

const host = 'localhost';

let node3010: ProofOfInnocenceNode;
let node3011: ProofOfInnocenceNode;
let apiUrl: string;

let base64Credentials: string;

let nodeURLForListKeyStub: SinonStub;
let initNetworkProvidersStub: SinonStub;
let isListProviderStub: SinonStub;

describe('JSON RPC API Tests', function () {
  before(async function () {
    this.timeout(40000);

    // // Stub initNetworkProviders to avoid real network calls
    // initNetworkProvidersStub = sinon.stub(
    //   ActiveNetworkProviders,
    //   'initNetworkProviders',
    // );
    // initNetworkProvidersStub.callsFake(async () => {
    //   // Mock behavior as required, currently does nothing
    // });

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
    // Create stubs
    isListProviderStub = sinon.stub(General, 'isListProvider');
    nodeURLForListKeyStub = sinon.stub(General, 'nodeURLForListKey');
  });

  afterEach(async function () {
    nodeURLForListKeyStub.restore();
    isListProviderStub.restore();
  });

  after(async function () {
    await node3010.stop();
    await node3011.stop();

    // Stub for all to prevent any network calls to eth goerli etc.
    // TODO: sometimes the connections seem to cause timeouts
    // initNetworkProvidersStub.restore();
  });

  describe('Unsupported methods', () => {
    it('Should return 404 for POST / unsupportedMethod', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'unsupportedMethod',
        params: {},
        id: 1,
      };

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(404);
        expect(err.response.data).to.deep.equal({
          jsonrpc: '2.0',
          error: { code: -32601, message: 'Method not found' },
          id: 1,
        });
      }
    });
  });

  describe('ppoi_node_status', () => {
    it('Should return 200 for POST / ppoi_node_status', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_node_status',
        params: {},
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      const body = response.data.result as unknown as NodeStatusAllNetworks;

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

    it('Should return 200 for POST / ppoi_node_status with listKey', async () => {
      // Stub nodeURLForListKey with the aggregator key
      nodeURLForListKeyStub.returns('http://localhost:3011');

      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_node_status',
        params: { listKey },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      const body = response.data.result as unknown as NodeStatusAllNetworks;

      expect(response.status).to.equal(200);
      expect(body).to.have.keys(['listKeys', 'forNetwork']);
      expect(body.forNetwork).to.have.keys(['Ethereum_Goerli']);
      expect(body.forNetwork.Ethereum_Goerli).to.have.keys([
        'legacyTransactProofs',
        'txidStatus',
        'listStatuses',
        'shieldQueueStatus',
      ]);
    });
  });

  describe('ppoi_poi_events', () => {
    it('Should return 200 for POST / ppoi_poi-events', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_poi_events',
        params: {
          chainType: '0',
          chainID: '5',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey,
          startIndex: 0,
          endIndex: 1,
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_poi-events with invalid body', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_poi_events',
        params: {
          chainType: '0',
          chainID: '5',
          startIndex: 0,
          endIndex: 1,
        },
        id: 1,
      };

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data).to.have.property('error');
        expect(err.response.data.error).to.have.property('code', -32602);
        expect(err.response.data.error).to.have.property(
          'message',
          'Invalid params',
        );

        // Extract missing properties from the validation errors
        const missingProperties = err.response.data.error.data.map(
          (error: ValidationError) => {
            return error.params.missingProperty;
          },
        );

        // Check if the specific properties are included in the missing properties
        expect(missingProperties).to.include.members([
          'txidVersion',
          'listKey',
        ]);
      }
    });

    it('Should return 400 for POST / ppoi_poi-events with invalid listKey', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_poi_events',
        params: {
          chainType: '0',
          chainID: '5',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey: 'fake_list_key',
          startIndex: 0,
          endIndex: 1,
        },
        id: 1,
      };

      // Stub isListProvider to get full error message as an aggregator
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data.error.data).to.equal('Invalid listKey');
      }
    });

    it('Should return 400 for POST / ppoi_poi-events with rangeLength > MAX_EVENT_QUERY_RANGE_LENGTH', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_poi_events',
        params: {
          chainType: '0',
          chainID: '5',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey,
          startIndex: 0,
          endIndex: 501,
        },
        id: 1,
      };

      // Stub isListProvider to get full error message as an aggregator
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data).to.deep.equal({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Max event query range length is ${QueryLimits.MAX_EVENT_QUERY_RANGE_LENGTH}`,
          },
          id: 1,
        });
      }
    });

    it('Should return 400 for POST / ppoi_poi-events with rangeLength < 0', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_poi_events',
        params: {
          chainType: '0',
          chainID: '5',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey,
          startIndex: 1,
          endIndex: 0,
        },
        id: 1,
      };

      // Stub isListProvider to get full error message as an aggregator
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data).to.deep.equal({
          jsonrpc: '2.0',
          error: { code: -32602, message: 'Invalid query range' },
          id: 1,
        });
      }
    });
  });

  describe('ppoi_poi_merkletree_leaves', () => {
    it('Should return 200 for POST / ppoi_poi_merkletree_leaves', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_poi_merkletree_leaves',
        params: {
          chainType: '0',
          chainID: '5',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey,
          startIndex: 0,
          endIndex: 1,
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_poi_merkletree_leaves with invalid body', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_poi_merkletree_leaves',
        params: {
          chainType: '0',
          chainID: '5',
          startIndex: 0,
          endIndex: 1,
        },
        id: 1,
      };

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data).to.have.property('error');
        expect(err.response.data.error).to.have.property('code', -32602);
        expect(err.response.data.error).to.have.property(
          'message',
          'Invalid params',
        );

        // Extract missing properties from the validation errors
        const missingProperties = err.response.data.error.data.map(
          (error: ValidationError) => {
            return error.params.missingProperty;
          },
        );

        // Check if the specific properties are included in the missing properties
        expect(missingProperties).to.include.members([
          'txidVersion',
          'listKey',
        ]);
      }
    });

    it('Should return 400 for POST / ppoi_poi_merkletree_leaves with invalid listKey', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_poi_merkletree_leaves',
        params: {
          chainType: '0',
          chainID: '5',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey: 'fake_list_key',
          startIndex: 0,
          endIndex: 1,
        },
        id: 1,
      };

      // Stub isListProvider to get full error message as an aggregator
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data.error.data).to.equal('Invalid listKey');
      }
    });

    it('Should return 400 for POST / ppoi_poi_merkletree_leaves with rangeLength > MAX_POI_MERKLETREE_LEAVES_QUERY_RANGE_LENGTH', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_poi_merkletree_leaves',
        params: {
          chainType: '0',
          chainID: '5',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey,
          startIndex: 0,
          endIndex: 501,
        },
        id: 1,
      };

      // Stub isListProvider to get full error message as an aggregator
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data).to.deep.equal({
          jsonrpc: '2.0',
          error: {
            code: -32602,
            message: `Max event query range length is ${QueryLimits.MAX_POI_MERKLETREE_LEAVES_QUERY_RANGE_LENGTH}`,
          },
          id: 1,
        });
      }
    });

    it('Should return 400 for POST / ppoi_poi_merkletree_leaves with rangeLength < 0', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_poi_merkletree_leaves',
        params: {
          chainType: '0',
          chainID: '5',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey,
          startIndex: 1,
          endIndex: 0,
        },
        id: 1,
      };

      // Stub isListProvider to get full error message as an aggregator
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data).to.deep.equal({
          jsonrpc: '2.0',
          error: { code: -32602, message: 'Invalid query range' },
          id: 1,
        });
      }
    });
  });

  describe('ppoi_transact_proofs', () => {
    it('Should return 200 for POST / ppoi_transact_proofs', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_transact_proofs',
        params: {
          chainType: '0',
          chainID: '5',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          bloomFilterSerialized: 'someValidSerializedData',
          listKey,
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_transact_proofs with invalid body', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_transact_proofs',
        params: {
          chainType: '0',
          chainID: '5',
          bloomFilterSerialized: 'someValidSerializedData',
          listKey,
        },
        id: 1,
      };

      // Stub isListProvider to get full error message as an aggregator
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        // console.log(err.response.data);
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data).to.have.property('error');
        expect(err.response.data.error).to.have.property('code', -32602);
        expect(err.response.data.error).to.have.property(
          'message',
          'Invalid params',
        );

        // Extract missing properties from the validation errors
        const missingProperties = err.response.data.error.data.map(
          (error: ValidationError) => {
            return error.params.missingProperty;
          },
        );

        // Check if the specific properties are included in the missing properties
        expect(missingProperties).to.include.members(['txidVersion']);
      }
    });

    it('Should return 400 for POST / ppoi_transact_proofs with Invalid listKey', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_transact_proofs',
        params: {
          chainType: '0',
          chainID: '5',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          bloomFilterSerialized: 'someValidSerializedData',
          listKey: 'fake_list_key',
        },
        id: 1,
      };

      // Stub isListProvider to get full error message as an aggregator
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        // console.log(err.response.data);
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data.error.data).to.equal('Invalid listKey');
      }
    });
  });

  describe('ppoi_legacy_transact_proofs', () => {
    it('Should return 200 for POST / ppoi_legacy_transact_proofs', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_legacy_transact_proofs',
        params: {
          chainType: '0',
          chainID: '5',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          bloomFilterSerialized: BlockedShieldsCache.serializeBloomFilter(
            listKey,
            NetworkName.EthereumGoerli,
            txidVersion,
          ),
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_legacy_transact_proofs with invalid body', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_legacy_transact_proofs',
        params: {
          chainType: '0',
          chainID: '5',
          bloomFilterSerialized: BlockedShieldsCache.serializeBloomFilter(
            listKey,
            NetworkName.EthereumGoerli,
            txidVersion,
          ),
        },
        id: 1,
      };

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err) {
        // console.log(err.response.data);
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data).to.have.property('error');
        expect(err.response.data.error).to.have.property('code', -32602);
        expect(err.response.data.error).to.have.property(
          'message',
          'Invalid params',
        );

        // Extract missing properties from the validation errors
        const missingProperties = err.response.data.error.data.map(
          (error: ValidationError) => {
            return error.params.missingProperty;
          },
        );

        // Check if the specific properties are included in the missing properties
        expect(missingProperties).to.include.members(['txidVersion']);
      }
    });
  });

  describe('ppoi_blocked_shields', () => {});

  describe('ppoi_submit_poi_events', () => {});

  describe('ppoi_submit_validated_txid', () => {});

  describe('ppoi_remove_transact_proof', () => {});

  describe('ppoi_submit_transact_proof', () => {});

  describe('ppoi_submit_legacy_transact_proofs', () => {});

  describe('ppoi_submit_single_commitment_proofs', () => {});

  describe('ppoi_pois_per_list', () => {});

  describe('ppoi_pois_per_blinded_commitment', () => {});

  describe('ppoi_merkle_proofs', () => {});

  describe('ppoi_validated_txid', () => {});

  describe('ppoi_validate_txid_merkleroot', () => {});

  describe('ppoi_validate_poi_merkleroots', () => {});
});
