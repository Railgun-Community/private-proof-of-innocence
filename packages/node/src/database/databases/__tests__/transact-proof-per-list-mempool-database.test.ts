import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { TransactProofPerListMempoolDatabase } from '../transact-proof-per-list-mempool-database';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';
import { TransactProofMempoolDBItem } from '../../../models/database-types';
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

    // Check if a unique index exists for the combination of 'listKey' and 'firstBlindedCommitment' fields
    const uniqueCombinedIndexExists = indexes.some(index => {
      return (
        'key' in index &&
        'listKey' in index.key &&
        'firstBlindedCommitment' in index.key &&
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
    const transactProofItem: TransactProofMempoolDBItem = {
      listKey: listKey,
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
      firstBlindedCommitment: 'blindedCommitmentsOut_0', // This will be ignored
      railgunTxidIfHasUnshield: '0x00',
    };

    // Insert the item
    await db.insertTransactProof(
      listKey,
      transactProofItem,
      transactProofItem.firstBlindedCommitment,
    );

    // Check that the proof exists and is in getAllTransactProofsAndLists
    expect(await db.proofExists(listKey, 'blindedCommitmentsOut_0')).to.equal(
      true,
    );
    expect(
      await db.proofExistsContainingBlindedCommitment(
        listKey,
        'blindedCommitmentsOut_1',
      ),
    ).to.equal(true);
  });

  it('Should delete a transact proof', async () => {
    // Insert a proof into the database
    const transactProofItem: TransactProofMempoolDBItem = {
      listKey: listKey,
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
      firstBlindedCommitment: 'firstBlindedCommitment',
      railgunTxidIfHasUnshield: '0x00',
    };

    // Insert the item
    await db.insertTransactProof(
      listKey,
      transactProofItem,
      transactProofItem.firstBlindedCommitment,
    );

    // Check that the proof exists
    expect(
      await db.proofExists(listKey, transactProofItem.blindedCommitmentsOut[0]),
    ).to.equal(true);

    // Delete the proof
    await db.deleteProof(listKey, transactProofItem.blindedCommitmentsOut[0]);

    // Check that the proof no longer exists
    expect(
      await db.proofExists(listKey, transactProofItem.blindedCommitmentsOut[0]),
    ).to.equal(false);
  });
});
