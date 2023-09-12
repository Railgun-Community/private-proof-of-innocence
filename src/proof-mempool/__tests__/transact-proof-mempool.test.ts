import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { TransactProofMempool } from '../transact-proof-mempool';
import * as SnarkProofVerifyModule from '../snark-proof-verify';
import { RailgunTxidMerkletreeManager } from '../../railgun-txids/railgun-txid-merkletree-manager';
import Sinon, { SinonStub } from 'sinon';
import { NetworkName } from '@railgun-community/shared-models';
import { TransactProofData } from '../../models/proof-types';
import { MOCK_SNARK_PROOF } from '../../tests/mocks.test';
import { TransactProofPerListMempoolDatabase } from '../../database/databases/transact-proof-per-list-mempool-database';
import { DatabaseClient } from '../../database/database-client-init';
import { TransactProofMempoolCache } from '../transact-proof-mempool-cache';
import { ProofMempoolBloomFilter } from '../proof-mempool-bloom-filters';
import { POIHistoricalMerklerootDatabase } from '../../database/databases/poi-historical-merkleroot-database';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;
const listKey = 'abc';

let transactProofMempoolDB: TransactProofPerListMempoolDatabase;
let poiHistoricalMerklerootDatabase: POIHistoricalMerklerootDatabase;

let snarkVerifyStub: SinonStub;
let txidMerklerootExistsStub: SinonStub;

describe('transact-proof-mempool', () => {
  before(async () => {
    await DatabaseClient.init();
    transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
      networkName,
    );
    poiHistoricalMerklerootDatabase = new POIHistoricalMerklerootDatabase(
      networkName,
    );
    snarkVerifyStub = Sinon.stub(SnarkProofVerifyModule, 'verifySnarkProof');
    txidMerklerootExistsStub = Sinon.stub(
      RailgunTxidMerkletreeManager,
      'checkIfMerklerootExistsByTxidIndex',
    );
  });

  beforeEach(() => {
    TransactProofMempoolCache.clearCache_FOR_TEST_ONLY();
  });

  afterEach(async () => {
    await transactProofMempoolDB.deleteAllItems_DANGEROUS();
    await poiHistoricalMerklerootDatabase.deleteAllItems_DANGEROUS();
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
      txidIndex: 55,
      txMerkleroot: '0x1234567890',
      blindedCommitmentInputs: ['0x3333', '0x4444'],
      blindedCommitmentOutputs: ['0x5555', '0x6666'],
    };

    // 1. FAIL: Snark verifies, but only one merkleroot is in POI Historical Merkleroots.
    snarkVerifyStub.resolves(true);
    txidMerklerootExistsStub.resolves(false);
    await poiHistoricalMerklerootDatabase.insertMerkleroot(
      listKey,
      transactProofData.poiMerkleroots[0],
    );
    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      transactProofData,
    );
    await expect(
      transactProofMempoolDB.proofExists(
        listKey,
        transactProofData.blindedCommitmentInputs[0],
      ),
    ).to.eventually.equal(false);

    // 2. THROW: commitmentHash is in TransactQueue, but snark fails verification.
    snarkVerifyStub.resolves(false);
    txidMerklerootExistsStub.resolves(true);
    await poiHistoricalMerklerootDatabase.insertMerkleroot(
      listKey,
      transactProofData.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDatabase.insertMerkleroot(
      listKey,
      transactProofData.poiMerkleroots[1],
    );
    await expect(
      TransactProofMempool.submitProof(listKey, networkName, transactProofData),
    ).to.be.rejectedWith('Invalid proof');

    // 3. FAIL: Historical txid merkleroot is not found.
    snarkVerifyStub.resolves(true);
    txidMerklerootExistsStub.resolves(false);
    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      transactProofData,
    );
    await expect(
      transactProofMempoolDB.proofExists(
        listKey,
        transactProofData.blindedCommitmentInputs[0],
      ),
    ).to.eventually.equal(false);

    // 4. SUCCESS: snark verifies and commitmentHash recognized.
    snarkVerifyStub.resolves(true);
    txidMerklerootExistsStub.resolves(true);
    await TransactProofMempool.submitProof(
      listKey,
      networkName,
      transactProofData,
    );
    await expect(
      transactProofMempoolDB.proofExists(
        listKey,
        transactProofData.blindedCommitmentInputs[0],
      ),
    ).to.eventually.equal(true);
  });

  it('Should add to cache and get bloom-filtered transact proofs', async () => {
    const transactProofData1: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x1111', '0x2222'],
      txidIndex: 56,
      txMerkleroot: '0x1234567890',
      blindedCommitmentInputs: ['0x3333', '0x4444'],
      blindedCommitmentOutputs: ['0x5555', '0x6666'],
    };
    const transactProofData2: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x9999', '0x8888'],
      txidIndex: 57,
      txMerkleroot: '0x0987654321',
      blindedCommitmentInputs: ['0x7777', '0x6666'],
      blindedCommitmentOutputs: ['0x5555', '0x4444'],
    };

    snarkVerifyStub.resolves(true);
    txidMerklerootExistsStub.resolves(true);

    await poiHistoricalMerklerootDatabase.insertMerkleroot(
      listKey,
      transactProofData1.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDatabase.insertMerkleroot(
      listKey,
      transactProofData1.poiMerkleroots[1],
    );
    await poiHistoricalMerklerootDatabase.insertMerkleroot(
      listKey,
      transactProofData2.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDatabase.insertMerkleroot(
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

    bloomFilter.add(transactProofData1.blindedCommitmentInputs[0]);
    const bloomFilterSerializedWithProof1 =
      ProofMempoolBloomFilter.serialize(bloomFilter);
    expect(
      TransactProofMempool.getFilteredProofs(
        listKey,
        networkName,
        bloomFilterSerializedWithProof1,
      ),
    ).to.deep.equal([transactProofData2]);
  });

  it('Should inflate cache from database', async () => {
    const transactProofData1: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x1111', '0x2222'],
      txidIndex: 58,
      txMerkleroot: '0x1234567890',
      blindedCommitmentInputs: ['0x3333', '0x4444'],
      blindedCommitmentOutputs: ['0x5555', '0x6666'],
    };
    const transactProofData2: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x9999', '0x8888'],
      txidIndex: 59,
      txMerkleroot: '0x0987654321',
      blindedCommitmentInputs: ['0x7777', '0x6666'],
      blindedCommitmentOutputs: ['0x5555', '0x4444'],
    };

    snarkVerifyStub.resolves(true);
    txidMerklerootExistsStub.resolves(true);

    await poiHistoricalMerklerootDatabase.insertMerkleroot(
      listKey,
      transactProofData1.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDatabase.insertMerkleroot(
      listKey,
      transactProofData1.poiMerkleroots[1],
    );
    await poiHistoricalMerklerootDatabase.insertMerkleroot(
      listKey,
      transactProofData2.poiMerkleroots[0],
    );
    await poiHistoricalMerklerootDatabase.insertMerkleroot(
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
  });
});
