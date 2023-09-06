import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ShieldProofMempool } from '../shield-proof-mempool';
import * as SnarkProofVerifyModule from '../snark-proof-verify';
import Sinon, { SinonStub } from 'sinon';
import { NetworkName } from '@railgun-community/shared-models';
import { ShieldProofData } from '../../models/proof-types';
import { MOCK_SNARK_PROOF } from '../../tests/mocks.test';
import { ShieldProofMempoolDatabase } from '../../database/databases/shield-proof-mempool-database';
import { DatabaseClient } from '../../database/database-client';
import { ShieldQueueDatabase } from '../../database/databases/shield-queue-database';
import { ShieldProofMempoolCache } from '../shield-proof-mempool-cache';
import { ProofMempoolBloomFilter } from '../proof-mempool-bloom-filters';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let shieldProofMempoolDB: ShieldProofMempoolDatabase;
let shieldQueueDB: ShieldQueueDatabase;

let snarkVerifyStub: SinonStub;

describe('shield-proof-mempool', () => {
  before(async () => {
    await DatabaseClient.init();
    shieldProofMempoolDB = new ShieldProofMempoolDatabase(networkName);
    shieldQueueDB = new ShieldQueueDatabase(networkName);
    snarkVerifyStub = Sinon.stub(SnarkProofVerifyModule, 'verifySnarkProof');
  });

  beforeEach(() => {
    ShieldProofMempoolCache.clearCache_FOR_TEST_ONLY();
  });

  afterEach(async () => {
    await shieldProofMempoolDB.deleteAllItems_DANGEROUS();
    await shieldQueueDB.deleteAllItems_DANGEROUS();
    ShieldProofMempoolCache.clearCache_FOR_TEST_ONLY();
  });

  after(() => {
    snarkVerifyStub.restore();
  });

  it('Should only add valid shield proofs', async () => {
    const shieldProofData: ShieldProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      commitmentHash: '0x1234',
      blindedCommitment: '0x5678',
    };

    // 1. FAIL: Snark verifies, but commitmentHash is not in ShieldQueue.
    snarkVerifyStub.resolves(true);
    await expect(
      shieldProofMempoolDB.proofExists(shieldProofData.commitmentHash),
    ).to.eventually.equal(false);

    // 2. THROW: commitmentHash is in ShieldQueue, but snark fails verification.
    snarkVerifyStub.resolves(false);
    await shieldQueueDB.insertPendingShield({
      txid: '0x0000',
      hash: shieldProofData.commitmentHash,
      timestamp: 1234567890,
      blockNumber: 123456,
    });
    await expect(
      ShieldProofMempool.submitProof(networkName, shieldProofData),
    ).to.be.rejectedWith('Invalid proof');

    // 3. SUCCESS: snark verifies and commitmentHash recognized.
    snarkVerifyStub.resolves(true);
    await ShieldProofMempool.submitProof(networkName, shieldProofData);
    await expect(
      shieldProofMempoolDB.proofExists(shieldProofData.commitmentHash),
    ).to.eventually.equal(true);
  });

  it('Should add to cache and get bloom-filtered shield proofs', async () => {
    const shieldProofData1: ShieldProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      commitmentHash: '0x1234',
      blindedCommitment: '0x5678',
    };
    const shieldProofData2: ShieldProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      commitmentHash: '0x8888',
      blindedCommitment: '0x9999',
    };

    snarkVerifyStub.resolves(true);

    await shieldQueueDB.insertPendingShield({
      txid: '0x0000',
      hash: shieldProofData1.commitmentHash,
      timestamp: 1234567890,
      blockNumber: 123436,
    });
    await shieldQueueDB.insertPendingShield({
      txid: '0x0001',
      hash: shieldProofData2.commitmentHash,
      timestamp: 1234567890,
      blockNumber: 123436,
    });

    await ShieldProofMempool.submitProof(networkName, shieldProofData1);
    await ShieldProofMempool.submitProof(networkName, shieldProofData2);

    expect(
      ShieldProofMempoolCache.getShieldProofs(networkName).length,
    ).to.equal(2);

    const bloomFilter = ProofMempoolBloomFilter.create();
    const bloomFilterSerializedNoData =
      ProofMempoolBloomFilter.serialize(bloomFilter);
    expect(
      ShieldProofMempool.getFilteredProofs(
        networkName,
        bloomFilterSerializedNoData,
      ),
    ).to.deep.equal([shieldProofData1, shieldProofData2]);

    bloomFilter.add(shieldProofData1.commitmentHash);
    const bloomFilterSerializedWithProof1 =
      ProofMempoolBloomFilter.serialize(bloomFilter);
    expect(
      ShieldProofMempool.getFilteredProofs(
        networkName,
        bloomFilterSerializedWithProof1,
      ),
    ).to.deep.equal([shieldProofData2]);
  });

  it('Should inflate cache from database', async () => {
    const shieldProofData1: ShieldProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      commitmentHash: '0x1234',
      blindedCommitment: '0x5678',
    };
    const shieldProofData2: ShieldProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      commitmentHash: '0x8888',
      blindedCommitment: '0x9999',
    };

    snarkVerifyStub.resolves(true);

    await shieldQueueDB.insertPendingShield({
      txid: '0x0000',
      hash: shieldProofData1.commitmentHash,
      timestamp: 1234567890,
      blockNumber: 123436,
    });
    await shieldQueueDB.insertPendingShield({
      txid: '0x0001',
      hash: shieldProofData2.commitmentHash,
      timestamp: 1234567890,
      blockNumber: 123436,
    });

    await ShieldProofMempool.submitProof(networkName, shieldProofData1);
    await ShieldProofMempool.submitProof(networkName, shieldProofData2);

    expect(
      ShieldProofMempoolCache.getShieldProofs(networkName).length,
    ).to.equal(2);

    ShieldProofMempoolCache.clearCache_FOR_TEST_ONLY();
    expect(
      ShieldProofMempoolCache.getShieldProofs(networkName).length,
    ).to.equal(0);

    await ShieldProofMempool.inflateCacheFromDatabase();
    expect(
      ShieldProofMempoolCache.getShieldProofs(networkName).length,
    ).to.equal(2);
  });
});
