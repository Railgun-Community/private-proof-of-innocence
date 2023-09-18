import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { TransactProofMempool } from '../transact-proof-mempool';
import * as SnarkProofVerifyModule from '../snark-proof-verify';
import { RailgunTxidMerkletreeManager } from '../../railgun-txids/railgun-txid-merkletree-manager';
import Sinon, { SinonStub } from 'sinon';
import { NetworkName } from '@railgun-community/shared-models';
import { TransactProofData } from '../../models/proof-types';
import { MOCK_LIST_KEYS, MOCK_SNARK_PROOF } from '../../tests/mocks.test';
import { TransactProofPerListMempoolDatabase } from '../../database/databases/transact-proof-per-list-mempool-database';
import { DatabaseClient } from '../../database/database-client-init';
import { TransactProofMempoolCache } from '../transact-proof-mempool-cache';
import { ProofMempoolBloomFilter } from '../proof-mempool-bloom-filters';
import { POIHistoricalMerklerootDatabase } from '../../database/databases/poi-historical-merkleroot-database';
import { ListProviderPOIEventQueue } from '../../list-provider/list-provider-poi-event-queue';
import { POIOrderedEventsDatabase } from '../../database/databases/poi-ordered-events-database';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;
const listKey = MOCK_LIST_KEYS[0];

let transactProofMempoolDB: TransactProofPerListMempoolDatabase;
let poiHistoricalMerklerootDB: POIHistoricalMerklerootDatabase;
let orderedEventDB: POIOrderedEventsDatabase;

let snarkVerifyStub: SinonStub;
let txidMerklerootExistsStub: SinonStub;

describe('transact-proof-mempool', () => {
  before(async () => {
    await DatabaseClient.init();
    transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
      networkName,
    );
    poiHistoricalMerklerootDB = new POIHistoricalMerklerootDatabase(
      networkName,
    );
    orderedEventDB = new POIOrderedEventsDatabase(networkName);
    snarkVerifyStub = Sinon.stub(SnarkProofVerifyModule, 'verifySnarkProof');
    txidMerklerootExistsStub = Sinon.stub(
      RailgunTxidMerkletreeManager,
      'checkIfMerklerootExistsByTxidIndex',
    );
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
    snarkVerifyStub.restore();
    txidMerklerootExistsStub.restore();
  });

  it('Should only add valid transact proofs', async () => {
    const transactProofData: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x1111', '0x2222'],
      txidMerklerootIndex: 55,
      txidMerkleroot: '0x1234567890',
      blindedCommitmentOutputs: ['0x3333', '0x4444'],
    };

    // 1. THROW: Snark fails verification.
    snarkVerifyStub.resolves(false);
    txidMerklerootExistsStub.resolves(true);
    await expect(
      TransactProofMempool.submitProof(listKey, networkName, transactProofData),
    ).to.be.rejectedWith('Invalid proof');

    ListProviderPOIEventQueue.listKey = listKey;

    const listProviderEventQueueSpy = Sinon.spy(
      ListProviderPOIEventQueue,
      'queueUnsignedPOITransactEvent',
    );

    // 2. SUCCESS: snark verifies and commitmentHash recognized.
    snarkVerifyStub.resolves(true);
    txidMerklerootExistsStub.resolves(true);
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      transactProofData.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      transactProofData.poiMerkleroots[1],
    );
    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      transactProofData,
    );
    await expect(
      transactProofMempoolDB.proofExists(
        listKey,
        transactProofData.blindedCommitmentOutputs[0],
      ),
    ).to.eventually.equal(true);

    expect(listProviderEventQueueSpy.calledOnce).to.equal(true);
    listProviderEventQueueSpy.restore();
  });

  it('Should add to cache and get bloom-filtered transact proofs', async () => {
    const transactProofData1: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x1111', '0x2222'],
      txidMerklerootIndex: 56,
      txidMerkleroot: '0x1234567890',
      blindedCommitmentOutputs: ['0x3333', '0x4444'],
    };
    const transactProofData2: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x9999', '0x8888'],
      txidMerklerootIndex: 57,
      txidMerkleroot: '0x0987654321',
      blindedCommitmentOutputs: ['0x7777', '0x6666'],
    };

    snarkVerifyStub.resolves(true);
    txidMerklerootExistsStub.resolves(true);

    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      transactProofData1.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      transactProofData1.poiMerkleroots[1],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      transactProofData2.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      transactProofData2.poiMerkleroots[1],
    );

    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      transactProofData1,
    );
    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      transactProofData2,
    );

    expect(
      TransactProofMempoolCache.getTransactProofs(listKey, networkName).length,
    ).to.equal(2);

    const bloomFilter = ProofMempoolBloomFilter.create();
    const bloomFilterSerializedNoData =
      ProofMempoolBloomFilter.serialize(bloomFilter);
    expect(
      TransactProofMempool.getFilteredProofs(
        listKey,
        networkName,
        bloomFilterSerializedNoData,
      ),
    ).to.deep.equal([transactProofData1, transactProofData2]);

    bloomFilter.add(transactProofData1.blindedCommitmentOutputs[0]);
    const bloomFilterSerializedWithProof1 =
      ProofMempoolBloomFilter.serialize(bloomFilter);
    expect(
      TransactProofMempool.getFilteredProofs(
        listKey,
        networkName,
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
      blindedCommitmentOutputs: ['0x3333', '0x4444'],
    };
    const transactProofData2: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x9999', '0x8888'],
      txidMerklerootIndex: 59,
      txidMerkleroot: '0x0987654321',
      blindedCommitmentOutputs: ['0x7777', '0x6666'],
    };

    snarkVerifyStub.resolves(true);
    txidMerklerootExistsStub.resolves(true);

    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      transactProofData1.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      transactProofData1.poiMerkleroots[1],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      transactProofData2.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      transactProofData2.poiMerkleroots[1],
    );

    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      transactProofData1,
    );
    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      transactProofData2,
    );

    expect(
      TransactProofMempoolCache.getTransactProofs(listKey, networkName).length,
    ).to.equal(2);

    TransactProofMempoolCache.clearCache_FOR_TEST_ONLY();
    expect(
      TransactProofMempoolCache.getTransactProofs(listKey, networkName).length,
    ).to.equal(0);

    await TransactProofMempool.inflateCacheFromDatabase();
    expect(
      TransactProofMempoolCache.getTransactProofs(listKey, networkName).length,
    ).to.equal(2);
  }).timeout(10000);
});
