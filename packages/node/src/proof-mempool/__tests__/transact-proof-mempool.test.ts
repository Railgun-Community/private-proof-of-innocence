import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { TransactProofMempool } from '../transact-proof-mempool';
import * as SnarkProofVerifyModule from '../../util/snark-proof-verify';
import { RailgunTxidMerkletreeManager } from '../../railgun-txids/railgun-txid-merkletree-manager';
import Sinon, { SinonStub } from 'sinon';
import * as WalletModule from '../../engine/wallet';
import {
  NetworkName,
  TXIDVersion,
  TransactProofData,
} from '@railgun-community/shared-models';
import { MOCK_LIST_KEYS, MOCK_SNARK_PROOF } from '../../tests/mocks.test';
import { TransactProofPerListMempoolDatabase } from '../../database/databases/transact-proof-per-list-mempool-database';
import { DatabaseClient } from '../../database/database-client-init';
import { TransactProofMempoolCache } from '../transact-proof-mempool-cache';
import { POINodeBloomFilter } from '../../util/poi-node-bloom-filters';
import { POIHistoricalMerklerootDatabase } from '../../database/databases/poi-historical-merkleroot-database';
import { ListProviderPOIEventQueue } from '../../list-provider/list-provider-poi-event-queue';
import { POIOrderedEventsDatabase } from '../../database/databases/poi-ordered-events-database';
import { TransactProofMempoolPruner } from '../transact-proof-mempool-pruner';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;
const listKey = MOCK_LIST_KEYS[0];

let transactProofMempoolDB: TransactProofPerListMempoolDatabase;
let poiHistoricalMerklerootDB: POIHistoricalMerklerootDatabase;
let orderedEventDB: POIOrderedEventsDatabase;

let verifyTransactProofStub: SinonStub;
let txidMerklerootExistsStub: SinonStub;
let tryValidateRailgunTxidOccurredBeforeBlockNumberStub: SinonStub;

describe('transact-proof-mempool', () => {
  before(async function run() {
    await DatabaseClient.init();
    transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
      networkName,
      txidVersion,
    );
    poiHistoricalMerklerootDB = new POIHistoricalMerklerootDatabase(
      networkName,
      txidVersion,
    );
    orderedEventDB = new POIOrderedEventsDatabase(networkName, txidVersion);
    verifyTransactProofStub = Sinon.stub(
      SnarkProofVerifyModule,
      'verifyTransactProof',
    );
    txidMerklerootExistsStub = Sinon.stub(
      RailgunTxidMerkletreeManager,
      'checkIfMerklerootExistsByTxidIndex',
    );
    tryValidateRailgunTxidOccurredBeforeBlockNumberStub = Sinon.stub(
      WalletModule,
      'tryValidateRailgunTxidOccurredBeforeBlockNumber',
    ).resolves(false);
  });

  beforeEach(async () => {
    await transactProofMempoolDB.deleteAllItems_DANGEROUS();
    await poiHistoricalMerklerootDB.deleteAllItems_DANGEROUS();
    await orderedEventDB.deleteAllItems_DANGEROUS();
    TransactProofMempoolCache.clearCache_FOR_TEST_ONLY();
  });

  afterEach(async () => {
    await transactProofMempoolDB.deleteAllItems_DANGEROUS();
    await poiHistoricalMerklerootDB.deleteAllItems_DANGEROUS();
    await orderedEventDB.deleteAllItems_DANGEROUS();
    TransactProofMempoolCache.clearCache_FOR_TEST_ONLY();
  });

  after(() => {
    verifyTransactProofStub.restore();
    txidMerklerootExistsStub.restore();
    tryValidateRailgunTxidOccurredBeforeBlockNumberStub.restore();
  });

  it('Should only add valid transact proofs', async () => {
    const transactProofData: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x1111', '0x2222'],
      txidMerklerootIndex: 55,
      txidMerkleroot: '0x1234567890',
      blindedCommitmentsOut: ['0x3333', '0x4444'],
      railgunTxidIfHasUnshield: '0x00',
    };

    // 1. THROW: Snark fails verification.
    verifyTransactProofStub.resolves(false);
    txidMerklerootExistsStub.resolves(true);
    await expect(
      TransactProofMempool.submitProof(
        listKey,
        networkName,
        txidVersion,
        transactProofData,
      ),
    ).to.be.rejectedWith('Invalid proof');

    ListProviderPOIEventQueue.listKey = listKey;

    const listProviderEventQueueSpy = Sinon.spy(
      ListProviderPOIEventQueue,
      'queueUnsignedPOITransactEvent',
    );

    // 2. SUCCESS: snark verifies and commitmentHash recognized.
    verifyTransactProofStub.resolves(true);
    txidMerklerootExistsStub.resolves(true);
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      0, // index
      transactProofData.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      1, // index
      transactProofData.poiMerkleroots[1],
    );
    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      txidVersion,
      transactProofData,
    );
    await expect(
      transactProofMempoolDB.proofExists(
        listKey,
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
      ),
    ).to.eventually.equal(true);

    expect(listProviderEventQueueSpy.calledOnce).to.equal(true);
    listProviderEventQueueSpy.restore();
  }).timeout(100000);

  it('Should add to cache and get bloom-filtered transact proofs', async () => {
    const transactProofData1: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x1111', '0x2222'],
      txidMerklerootIndex: 56,
      txidMerkleroot: '0x1234567890',
      blindedCommitmentsOut: ['0x3333', '0x4444'],
      railgunTxidIfHasUnshield: '0x00',
    };
    const transactProofData2: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x9999', '0x8888'],
      txidMerklerootIndex: 57,
      txidMerkleroot: '0x0987654321',
      blindedCommitmentsOut: [],
      railgunTxidIfHasUnshield: '0x7777',
    };

    verifyTransactProofStub.resolves(true);
    txidMerklerootExistsStub.resolves(true);

    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      0, // index
      transactProofData1.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      1, // index
      transactProofData1.poiMerkleroots[1],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      2, // index
      transactProofData2.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      3, // index
      transactProofData2.poiMerkleroots[1],
    );

    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      txidVersion,
      transactProofData1,
    );
    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      txidVersion,
      transactProofData2,
    );

    expect(
      TransactProofMempoolCache.getCacheSize(listKey, networkName, txidVersion),
    ).to.equal(2);

    const bloomFilter = POINodeBloomFilter.create();
    const bloomFilterSerializedNoData =
      POINodeBloomFilter.serialize(bloomFilter);
    expect(
      TransactProofMempool.getFilteredProofs(
        listKey,
        networkName,
        txidVersion,
        bloomFilterSerializedNoData,
      ),
    ).to.deep.equal([transactProofData1, transactProofData2]);

    bloomFilter.add(
      TransactProofMempoolCache.getBlindedCommitmentsCacheString(
        transactProofData1.blindedCommitmentsOut,
        transactProofData1.railgunTxidIfHasUnshield,
      ),
    );
    const bloomFilterSerializedWithProof1 =
      POINodeBloomFilter.serialize(bloomFilter);
    expect(
      TransactProofMempool.getFilteredProofs(
        listKey,
        networkName,
        txidVersion,
        bloomFilterSerializedWithProof1,
      ),
    ).to.deep.equal([transactProofData2]);
  }).timeout(10000);

  it('Should inflate cache from database', async () => {
    const transactProofData1: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x1111', '0x2222'],
      txidMerklerootIndex: 58,
      txidMerkleroot: '0x1234567890',
      blindedCommitmentsOut: ['0x3333', '0x4444'],
      railgunTxidIfHasUnshield: '0x45678900',
    };
    const transactProofData2: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x9999', '0x8888'],
      txidMerklerootIndex: 59,
      txidMerkleroot: '0x0987654321',
      blindedCommitmentsOut: ['0x7777', '0x6666'],
      railgunTxidIfHasUnshield: '0x00',
    };
    const transactProofData3: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x9999', '0x8888'],
      txidMerklerootIndex: 59,
      txidMerkleroot: '0x0987654321',
      blindedCommitmentsOut: ['0x7777', '0x6666'],
      railgunTxidIfHasUnshield: '0x45678900', // Same as #2 with a different railgunTxid - to test an edge case
    };

    verifyTransactProofStub.resolves(true);
    txidMerklerootExistsStub.resolves(true);

    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      0, // index
      transactProofData1.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      1, // index
      transactProofData1.poiMerkleroots[1],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      2, // index
      transactProofData2.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      3, // index
      transactProofData2.poiMerkleroots[1],
    );

    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      txidVersion,
      transactProofData1,
    );
    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      txidVersion,
      transactProofData2,
    );
    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      txidVersion,
      transactProofData3,
    );

    expect(
      TransactProofMempoolCache.getCacheSize(listKey, networkName, txidVersion),
    ).to.equal(3);

    TransactProofMempoolCache.clearCache_FOR_TEST_ONLY();
    expect(
      TransactProofMempoolCache.getCacheSize(listKey, networkName, txidVersion),
    ).to.equal(0);

    await TransactProofMempool.inflateCacheFromDatabase(MOCK_LIST_KEYS);
    expect(
      TransactProofMempoolCache.getCacheSize(listKey, networkName, txidVersion),
    ).to.equal(3);

    // Remove a proof and check cache
    await TransactProofMempoolPruner.removeProof(
      listKey,
      networkName,
      txidVersion,
      transactProofData1.blindedCommitmentsOut,
      transactProofData1.railgunTxidIfHasUnshield,
      false, // shouldSendNodeRequest
    );
    expect(
      TransactProofMempoolCache.getCacheSize(listKey, networkName, txidVersion),
    ).to.equal(2);
  }).timeout(10000);
});
