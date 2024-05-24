/**
 * @dev This test suite is for testing the JSON RPC API of the node.
 * @note JSON-RPC handler is connected to POST `/` endpoint.
 */
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import axios, { AxiosError } from 'axios';
import {
  BlindedCommitmentData,
  BlindedCommitmentType,
  ChainType,
  GetPOIsPerListParams,
  NETWORK_CONFIG,
  NetworkName,
  NodeStatusAllNetworks,
  POIEventType,
  SubmitTransactProofParams,
  TXIDVersion,
} from '@railgun-community/shared-models';
import { ProofOfInnocenceNode } from '../../proof-of-innocence-node';
import { MOCK_LIST_KEYS } from '../../tests/mocks.test';
import { LocalListProvider } from '../../local-list-provider';
import sinon, { SinonStub } from 'sinon';
import * as General from '../../config/general';
import { QueryLimits } from '../../config/query-limits';
import { BlockedShieldsCache } from '../../shields/blocked-shields-cache';
import { SignedPOIEvent } from '../../models/poi-types';
import { POIEventList } from '../../poi-events/poi-event-list';
import { RailgunTxidMerkletreeManager } from '../../railgun-txids/railgun-txid-merkletree-manager';
import { TransactProofMempool } from '../../proof-mempool/transact-proof-mempool';
import { POIMerkletreeManager } from '../../poi-events/poi-merkletree-manager';
import { SharedChainTypeIDParamsSchema } from '../schemas';
import { Config } from '../../config/config';

interface ValidationError {
  params: {
    missingProperty: string;
    message: string;
  };
}

chai.use(chaiAsPromised);
const { expect } = chai;

Config.NETWORK_NAMES = [NetworkName.EthereumSepolia];
const networkName = Config.NETWORK_NAMES[0];
const chainID = NETWORK_CONFIG[networkName].chain.id;

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
let verifyAndAddSignedPOIEventsWithValidatedMerklerootsStub: SinonStub;
let verifySignatureAndUpdateValidatedRailgunTxidStatusStub: SinonStub;
let submitProofStub: SinonStub;
let getMerkleProofsStub: SinonStub;

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
    verifyAndAddSignedPOIEventsWithValidatedMerklerootsStub = sinon.stub(
      POIEventList,
      'verifyAndAddSignedPOIEventsWithValidatedMerkleroots',
    );
    verifySignatureAndUpdateValidatedRailgunTxidStatusStub = sinon.stub(
      RailgunTxidMerkletreeManager,
      'verifySignatureAndUpdateValidatedRailgunTxidStatus',
    );
    submitProofStub = sinon.stub(TransactProofMempool, 'submitProof');
    getMerkleProofsStub = sinon.stub(POIMerkletreeManager, 'getMerkleProofs');
  });

  afterEach(async function () {
    nodeURLForListKeyStub.restore();
    isListProviderStub.restore();
    verifyAndAddSignedPOIEventsWithValidatedMerklerootsStub.restore();
    verifySignatureAndUpdateValidatedRailgunTxidStatusStub.restore();
    submitProofStub.restore();
    getMerkleProofsStub.restore();
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
    });
  });

  describe('ppoi_poi_events', () => {
    it.only('Should return 200 for POST / ppoi_poi-events', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_poi_events',
        params: {
          chainType: '0',
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
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
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          bloomFilterSerialized: BlockedShieldsCache.serializeBloomFilter(
            listKey,
            NetworkName.EthereumGoerli_DEPRECATED,
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
          chainID: chainID,
          bloomFilterSerialized: BlockedShieldsCache.serializeBloomFilter(
            listKey,
            NetworkName.EthereumGoerli_DEPRECATED,
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

  describe('ppoi_blocked_shields', () => {
    it('Should return 200 for POST / ppoi_blocked_shields', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_blocked_shields',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          bloomFilterSerialized: BlockedShieldsCache.serializeBloomFilter(
            listKey,
            NetworkName.EthereumGoerli_DEPRECATED,
            txidVersion,
          ),
          listKey,
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_blocked_shields with invalid body', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_blocked_shields',
        params: {
          chainType: '0',
          chainID: chainID,
          bloomFilterSerialized: BlockedShieldsCache.serializeBloomFilter(
            listKey,
            NetworkName.EthereumGoerli_DEPRECATED,
            txidVersion,
          ),
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

    it('Should return 400 for POST / ppoi_blocked_shields with invalid listKey', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_blocked_shields',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          bloomFilterSerialized: BlockedShieldsCache.serializeBloomFilter(
            'fake_list_key',
            NetworkName.EthereumGoerli_DEPRECATED,
            TXIDVersion.V2_PoseidonMerkle,
          ),
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

  describe('ppoi_submit_poi_events', () => {
    it('Should return 200 for POST /submit-poi-event', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_submit_poi_events',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey,
          signedPOIEvent: {
            index: 0,
            blindedCommitment: '',
            signature: '',
            type: POIEventType.Transact,
          },
          validatedMerkleroot: '',
        },
        id: 1,
      };

      // Stub verifyAndAddSignedPOIEventsWithValidatedMerkleroots that's used in the route logic
      verifyAndAddSignedPOIEventsWithValidatedMerklerootsStub.callsFake(
        async () => {},
      );

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST /submit-poi-event with Invalid listKey', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_submit_poi_events',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey: 'fake_list_key',
          signedPOIEvents: {
            index: 0,
            blindedCommitment: '',
            signature: '',
            type: POIEventType.Transact,
          },
          validatedMerkleroot: '',
        },
        id: 1,
      };

      // Stub isListProvider to get full error message as an aggregator
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err: any) {
        // console.log(err.response.data);
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data.error.data).to.equal('Invalid listKey');
      }
    });
  });

  describe('ppoi_submit_validated_txid', () => {
    it('Should return 200 for POST / ppoi_submit_validated_txid', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_submit_validated_txid',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          txidIndex: 0,
          merkleroot: '',
          signature: '0x00',
          listKey,
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_submit_validated_txid with invalid listKey', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_submit_validated_txid',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          txidIndex: 0,
          merkleroot: '',
          signature: '0x00',
          listKey: 'fake_list_key',
        },
        id: 1,
      };

      // Stub isListProvider to get full error message as an aggregator
      isListProviderStub.callsFake(() => true);

      // Stub verifySignatureAndUpdateValidatedRailgunTxidStatus that's used in the route logic
      verifySignatureAndUpdateValidatedRailgunTxidStatusStub.callsFake(
        async () => {},
      );

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err: any) {
        // console.log(err.response.data);
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data.error.data).to.equal('Invalid listKey');
      }
    });
  });

  describe('ppoi_remove_transact_proof', () => {
    it('Should return 200 for POST / ppoi_remove_transact_proof', async () => {
      const jsonRpcRequest = {
        jsonRpc: '2.0',
        method: 'ppoi_remove_transact_proof',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey,
          blindedCommitmentsOut: [
            '0x1441c994c1336075c8fc3687235e583fb5fa37e561184585bac31e3c029a46eb',
            '0x19f596cb35c783ce81498026696fae8f84de0937f68354ef29a08bf8c01e3f38',
          ],
          railgunTxidIfHasUnshield:
            '0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62',
          signature: '0x00',
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 POST / ppoi_remove_transact_proof with invalid listKey', async () => {
      const jsonRpcRequest = {
        jsonRpc: '2.0',
        method: 'ppoi_remove_transact_proof',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey: 'fake_list_key',
          blindedCommitmentsOut: [
            '0x1441c994c1336075c8fc3687235e583fb5fa37e561184585bac31e3c029a46eb',
            '0x19f596cb35c783ce81498026696fae8f84de0937f68354ef29a08bf8c01e3f38',
          ],
          railgunTxidIfHasUnshield:
            '0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62',
          signature: '0x00',
        },
        id: 1,
      };

      // Stub isListProvider to get full error message as an aggregator
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err: any) {
        // console.log(err.response.data);
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data.error.data).to.equal('Invalid listKey');
      }
    });
  });

  describe('ppoi_submit_transact_proof', () => {
    it('Should return 200 for POST / ppoi_submit_transact_proof', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_submit_transact_proof',
        params: {
          chainType: '0',
          chainID: chainID,
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
        },
        id: 1,
      };

      // Stub the submitProof function used in the api call as an async function
      submitProofStub.callsFake(async () => {});

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_submit_transact_proof with invalid body', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_submit_transact_proof',
        params: {
          chainType: '0',
          chainID: chainID,
          listKey: listKey,
          transactProofData: 0,
        },
        id: 1,
      };

      // Stub the isListProvider function to fake being an aggregator so error message is returned
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (error: any) {
        expect(error).to.be.instanceOf(AxiosError);
        expect(error.response.status).to.equal(400);
        expect(error.response.data).to.have.property('error');
        expect(error.response.data.error).to.have.property('code', -32602);
        expect(error.response.data.error).to.have.property(
          'message',
          'Invalid params',
        );

        // Extract missing properties from the validation errors
        const missingProperties = error.response.data.error.data.map(
          (error: ValidationError) => {
            return error.params.missingProperty;
          },
        );

        // Check if the specific properties are included in the missing properties
        expect(missingProperties).to.include.members(['txidVersion']);
      }
    });

    it('Should return 400 for POST / ppoi_submit_transact_proof with invalid listKey', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_submit_transact_proof',
        params: {
          chainType: '0',
          chainID: chainID,
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
        },
        id: 1,
      };

      // Stub the isListProvider function to fake being an aggregator so error message is returned
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (error: any) {
        expect(error).to.be.instanceOf(AxiosError);
        expect(error.response.status).to.equal(400);
        expect(error.response.data.error.data).to.equal('Invalid listKey');
      }
    });
  });

  describe('ppoi_submit_legacy_transact_proofs', () => {
    it('Should return 200 for POST / ppoi_submit_legacy_transact_proofs', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_submit_legacy_transact_proofs',
        params: {
          chainType: '0',
          chainID: chainID,
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
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });
  });

  describe('ppoi_submit_single_commitment_proofs', () => {
    it('Should return 200 for POST / ppoi_submit_single_commitment_proofs', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_submit_single_commitment_proofs',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          singleCommitmentProofsData: {
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
                '136f24c883d58d7130d8e001a043bad3b2b09a36104bec5b6a0f8181b7d0fa70':
                  {
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
          },
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_submit_single_commitment_proofs with invalid body', async () => {
      // const chainType = '0';
      //
      // const txidVersion = TXIDVersion.V2_PoseidonMerkle;

      // await expect(
      //   AxiosTest.postRequest(
      //     `${apiUrl}/submit-single-commitment-proofs/${chainType}/${chainID}`,
      //     { txidVersion, singleCommitmentProofsData: { invalidBody: 3000 } },
      //   ),
      // ).to.eventually.be.rejectedWith(
      //   `Request failed with status code 400: must have required property 'commitment'`,
      // );

      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_submit_single_commitment_proofs',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          singleCommitmentProofsData: {
            invalidBody: 3000,
          },
        },
      };

      // Stub the isListProvider function to fake being an aggregator so error message is returned
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (error: any) {
        expect(error).to.be.instanceOf(AxiosError);
        expect(error.response.status).to.equal(400);
        expect(error.response.data).to.have.property('error');
        expect(error.response.data.error).to.have.property('code', -32602);
        expect(error.response.data.error).to.have.property(
          'message',
          'Invalid params',
        );

        // Extract missing properties from the validation errors
        const missingProperties = error.response.data.error.data.map(
          (error: ValidationError) => {
            return error.params.missingProperty;
          },
        );

        // Check if the specific properties are included in the missing properties
        expect(missingProperties).to.include.members([
          'commitment',
          'npk',
          'utxoTreeIn',
          'utxoTreeOut',
          'utxoPositionOut',
          'railgunTxid',
          'pois',
        ]);
      }
    });
  });

  describe('ppoi_pois_per_list', () => {
    it('Should return 200 for POST / ppoi_pois_per_list', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_pois_per_list',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKeys: [listKey],
          blindedCommitmentDatas: [
            {
              blindedCommitment: '',
              type: BlindedCommitmentType.Transact,
            },
            {
              blindedCommitment: '',
              type: BlindedCommitmentType.Shield,
            },
          ],
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_pois_per_list with invalid body', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_pois_per_list',
        params: {
          chainType: '0',
          chainID: chainID,
          listKey: 0,
          blindedCommitmentDatas: 0,
        },
        id: 1,
      };

      // Stub the isListProvider function to fake being an aggregator so error message is returned
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (error: any) {
        expect(error).to.be.instanceOf(AxiosError);
        expect(error.response.status).to.equal(400);
        expect(error.response.data).to.have.property('error');
        expect(error.response.data.error).to.have.property('code', -32602);
        expect(error.response.data.error).to.have.property(
          'message',
          'Invalid params',
        );

        // Extract missing properties from the validation errors
        const missingProperties = error.response.data.error.data.map(
          (error: ValidationError) => {
            return error.params.missingProperty;
          },
        );

        // Check if the specific properties are included in the missing properties
        expect(missingProperties).to.include.members(['txidVersion']);
      }
    });

    it('Should return 400 for POST / ppoi_pois_per_list with `Too many blinded commitments`', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_pois_per_list',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKeys: [listKey],
          blindedCommitmentDatas: Array.from(
            {
              length: QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS + 1,
            },
            () => ({
              blindedCommitment: '',
              type: BlindedCommitmentType.Transact,
            }),
          ),
        },
        id: 1,
      };

      // Stub the isListProvider function to fake being an aggregator so error message is returned
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (error: any) {
        expect(error).to.be.instanceOf(AxiosError);
        expect(error.response.status).to.equal(400);
        expect(error.response.data.error.message).to.equal(
          `Too many blinded commitments: max ${QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS}`,
        );
      }
    });
  });

  describe('ppoi_pois_per_blinded_commitment', () => {
    it('Should return 200 for POST / ppoi_pois_per_blinded_commitment', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_pois_per_blinded_commitment',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey: listKey,
          blindedCommitmentDatas: [
            {
              blindedCommitment: '',
              type: BlindedCommitmentType.Transact,
            },
            {
              blindedCommitment: '',
              type: BlindedCommitmentType.Shield,
            },
          ],
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_pois_per_blinded_commitment with too many blinded commitments', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_pois_per_blinded_commitment',
        params: {
          chainType: '0',
          chainID: chainID,
          listKey: listKey,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          blindedCommitmentDatas: Array.from(
            {
              length: QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS + 1,
            },
            () => ({
              blindedCommitment: '',
              type: BlindedCommitmentType.Transact,
            }),
          ),
        },
        id: 1,
      };

      // Stub the isListProvider function to fake being an aggregator so error message is returned
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (error: any) {
        expect(error).to.be.instanceOf(AxiosError);
        expect(error.response.status).to.equal(400);
        expect(error.response.data.error.message).to.equal(
          `Too many blinded commitments: max ${QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS}`,
        );
      }
    });
  });

  describe('ppoi_merkle_proofs', () => {
    it('Should return 200 for POST / ppoi_merkle_proofs', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_merkle_proofs',
        params: {
          chainType: '0',
          chainID: chainID,
          listKey: listKey,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          blindedCommitments: ['', ''],
        },
        id: 1,
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

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_merkle_proofs with invalid body', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_merkle_proofs',
        params: {
          chainType: '0',
          chainID: chainID,
          listKey: listKey,
          blindedCommitments: 0,
        },
        id: 1,
      };

      // Stub the isListProvider function to fake being an aggregator so error message is returned
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err: any) {
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

    it('Should return 400 for POST / ppoi_merkle_proofs with invalid listKey', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_merkle_proofs',
        params: {
          chainType: '0',
          chainID: chainID,
          listKey: 'fake_list_key',
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          blindedCommitments: ['', ''],
        },
        id: 1,
      };

      // Stub the isListProvider function to fake being an aggregator so error message is returned
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err: any) {
        // console.log(err.response.data);
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data.error.data).to.equal('Invalid listKey');
      }
    });

    it('Should return 400 for POST / ppoi_merkle_proofs with blindedCommitments.length > QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_merkle_proofs',
        params: {
          chainType: '0',
          chainID: chainID,
          listKey: listKey,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          blindedCommitments: Array.from(
            {
              length: QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS + 1,
            },
            () => '',
          ),
        },
        id: 1,
      };

      // Stub the isListProvider function to fake being an aggregator so error message is returned
      isListProviderStub.callsFake(() => true);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err: any) {
        expect(err).to.be.instanceOf(AxiosError);
        expect(err.response.status).to.equal(400);
        expect(err.response.data.error.message).to.equal(
          `Too many blinded commitments: max ${QueryLimits.GET_MERKLE_PROOFS_MAX_BLINDED_COMMITMENTS}`,
        );
      }
    });
  });

  describe('ppoi_validated_txid', () => {
    it('Should return 200 for POST / ppoi_validated_txid', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_validated_txid',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });
  });

  describe('ppoi_validate_txid_merkleroot', () => {
    it('Should return 200 for POST / ppoi_validate_txid_merkleroot', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_validate_txid_merkleroot',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          tree: 0,
          index: 0,
          merkleroot: '',
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });

    it('Should return 400 for POST / ppoi_validate_txid_merkleroot with invalid body', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_validate_txid_merkleroot',
        params: {
          chainType: '0',
          chainID: chainID,
          tree: 0,
          index: 0,
          merkleroot: 0,
        },
        id: 1,
      };

      // Stub the isListProvider function to fake being an aggregator so error message is returned
      isListProviderStub.callsFake(() => false);

      try {
        await axios.post(`${apiUrl}/`, jsonRpcRequest);
        throw new Error('Expected request to fail');
      } catch (err: any) {
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

  describe('ppoi_validate_poi_merkleroots', () => {
    it('Should return 200 for POST /validate-poi-merkleroots/:chainType/:chainID', async () => {
      const jsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'ppoi_validate_poi_merkleroots',
        params: {
          chainType: '0',
          chainID: chainID,
          txidVersion: TXIDVersion.V2_PoseidonMerkle,
          listKey,
          poiMerkleroots: [''],
        },
        id: 1,
      };

      const response = await axios.post(`${apiUrl}/`, jsonRpcRequest);

      expect(response.status).to.equal(200);
    });
  });
});
