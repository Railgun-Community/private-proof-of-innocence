import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { TransactProofPerListMempoolDatabase } from '../transact-proof-per-list-mempool-database';
import {
  NetworkName,
  TXIDVersion,
  TransactProofData,
} from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';
import { MOCK_LIST_KEYS } from '../../../tests/mocks.test';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let db: TransactProofPerListMempoolDatabase;

const listKey = MOCK_LIST_KEYS[0];

describe('transact-proof-per-list-mempool-database', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new TransactProofPerListMempoolDatabase(networkName, txidVersion);
    await db.createCollectionIndices();
  });

  // Clear the database before each test
  beforeEach(async () => {
    await db.deleteAllItems_DANGEROUS();
  });

  it('Should create collection indices', async () => {
    // Fetch all indexes for the collection
    const indexes = await db.listCollectionIndexes();

    // Check if a unique index exists
    const uniqueCombinedIndexExists = indexes.some(index => {
      return (
        'key' in index &&
        'listKey' in index.key &&
        'blindedCommitmentsOut' in index.key &&
        'railgunTxidIfHasUnshield' in index.key &&
        index.unique === true
      );
    });

    // Assert that the unique index exists
    expect(uniqueCombinedIndexExists).to.equal(true);
  });

  it('Should correctly initialize TransactProofPerListMempoolDatabase', () => {
    expect(db).to.be.instanceOf(TransactProofPerListMempoolDatabase);
  });

  it('Should insert and get a valid transact proof', async () => {
    const transactProofData: TransactProofData = {
      snarkProof: {
        pi_a: ['pi_a_0', 'pi_a_1'],
        pi_b: [
          ['pi_b_0_0', 'pi_b_0_1'],
          ['pi_b_1_0', 'pi_b_1_1'],
        ],
        pi_c: ['pi_c_0', 'pi_c_1'],
      },
      poiMerkleroots: ['poiMerkleroots_0', 'poiMerkleroots_1'],
      txidMerklerootIndex: 58,
      txidMerkleroot: 'txMerkleroot',
      blindedCommitmentsOut: [
        'blindedCommitmentsOut_0',
        'blindedCommitmentsOut_1',
      ],
      railgunTxidIfHasUnshield: '0x123456',
    };

    // Insert the item
    await db.insertTransactProof(listKey, transactProofData);

    // Check that the proof exists
    expect(
      await db.proofExists(listKey, ['blindedCommitmentsOut_0'], '0x123456'),
    ).to.equal(false);
    expect(
      await db.proofExists(
        listKey,
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
      ),
    ).to.equal(true);
    expect(
      await db.getProofContainingBlindedCommitmentOrRailgunTxidIfHasUnshield(
        listKey,
        'blindedCommitmentsOut_1',
      ),
    ).to.deep.equal({ listKey, ...transactProofData });
    expect(
      await db.getProofContainingBlindedCommitmentOrRailgunTxidIfHasUnshield(
        listKey,
        '0x123456',
      ),
    ).to.deep.equal({ listKey, ...transactProofData });
  });

  it('Should delete a transact proof', async () => {
    // Insert a proof into the database
    const transactProofData: TransactProofData = {
      snarkProof: {
        pi_a: ['pi_a_0', 'pi_a_1'],
        pi_b: [
          ['pi_b_0_0', 'pi_b_0_1'],
          ['pi_b_1_0', 'pi_b_1_1'],
        ],
        pi_c: ['pi_c_0', 'pi_c_1'],
      },
      poiMerkleroots: ['poiMerkleroots_0', 'poiMerkleroots_1'],
      txidMerklerootIndex: 59,
      txidMerkleroot: 'txMerkleroot',
      blindedCommitmentsOut: [
        'blindedCommitmentsOut_0',
        'blindedCommitmentsOut_1',
      ],
      railgunTxidIfHasUnshield: '0x00',
    };

    // Insert the item
    await db.insertTransactProof(listKey, transactProofData);

    // Check that the proof exists
    expect(
      await db.proofExists(
        listKey,
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
      ),
    ).to.equal(true);

    // Delete the proof
    await db.deleteProof(
      listKey,
      transactProofData.blindedCommitmentsOut,
      transactProofData.railgunTxidIfHasUnshield,
    );

    // Check that the proof no longer exists
    expect(
      await db.proofExists(
        listKey,
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
      ),
    ).to.equal(false);
  });

  it('Should delete a transact proof with no blindedCommitmentsOut', async () => {
    // Insert a proof into the database
    const transactProofData: TransactProofData = {
      snarkProof: {
        pi_a: ['pi_a_0', 'pi_a_1'],
        pi_b: [
          ['pi_b_0_0', 'pi_b_0_1'],
          ['pi_b_1_0', 'pi_b_1_1'],
        ],
        pi_c: ['pi_c_0', 'pi_c_1'],
      },
      poiMerkleroots: ['poiMerkleroots_0', 'poiMerkleroots_1'],
      txidMerklerootIndex: 59,
      txidMerkleroot: 'txMerkleroot',
      blindedCommitmentsOut: [],
      railgunTxidIfHasUnshield: '0x001234',
    };

    // Insert the item
    await db.insertTransactProof(listKey, transactProofData);

    // Check that the proof exists
    expect(
      await db.proofExists(
        listKey,
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
      ),
    ).to.equal(true);

    // Delete the proof
    await db.deleteProof(
      listKey,
      transactProofData.blindedCommitmentsOut,
      transactProofData.railgunTxidIfHasUnshield,
    );

    // Check that the proof no longer exists
    expect(
      await db.proofExists(
        listKey,
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
      ),
    ).to.equal(false);
  });
});
