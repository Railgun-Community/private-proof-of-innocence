import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { TransactProofPerListMempoolDatabase } from '../transact-proof-per-list-mempool-database';
import { NetworkName } from '@railgun-community/shared-models';
<<<<<<< Updated upstream
import { DatabaseClient } from '../../database-client';
import { TransactProofMempoolDBItem } from '../../../models/database-types';
=======
import { DatabaseClient } from '../../database-client-init';
import {
    TransactProofMempoolDBItem,
} from '../../../models/database-types';
>>>>>>> Stashed changes

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let db: TransactProofPerListMempoolDatabase;

describe('TransactProofPerListMempoolDatabase', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new TransactProofPerListMempoolDatabase(networkName);
    await db.createCollectionIndices();
  });

  // Clear the database before each test
  beforeEach(async () => {
    await db.deleteAllItems_DANGEROUS();
  });

  it('Should create collection indeces', async () => {
    // Fetch all indexes for the collection
    const indexes = await db.getCollectionIndexes();

    // Check if a unique index exists for the combination of 'listKey' and 'firstBlindedCommitmentInput' fields
    const uniqueCombinedIndexExists = indexes.some((index) => {
      return (
        'key' in index &&
        'listKey' in index.key &&
        'firstBlindedCommitmentInput' in index.key &&
        index.unique === true
      );
    });

    // Assert that the unique index exists
    expect(uniqueCombinedIndexExists).to.equal(true);
  });

<<<<<<< Updated upstream
  it('Should correctly initialize TransactProofPerListMempoolDatabase', () => {
    expect(db).to.be.instanceOf(TransactProofPerListMempoolDatabase);
  });
=======
    it('Should create collection indeces', async () => {
        // Fetch all indexes for the collection
        const indexes = await db.listCollectionIndexes();
>>>>>>> Stashed changes

  it('Should insert and get a valid transact proof', async () => {
    const listKey = 'someListKey';
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
      txidIndex: 58,
      txMerkleroot: 'txMerkleroot',
      blindedCommitmentInputs: [
        'blindedCommitmentInputs_0',
        'blindedCommitmentInputs_1',
      ],
      blindedCommitmentOutputs: [
        'blindedCommitmentOutputs_0',
        'blindedCommitmentOutputs_1',
      ],
      firstBlindedCommitmentInput: 'firstBlindedCommitmentInput', // This will be ignored
    };

    // Insert the item
    await db.insertValidTransactProof(listKey, transactProofItem);

    // Check that the proof exists and is in getAllTransactProofsAndLists
    expect(await db.proofExists(listKey, 'blindedCommitmentInputs_0')).to.equal(
      true,
    ); // Changed this to match the first item in blindedCommitmentInputs
  });

  it('Should delete a transact proof', async () => {
    // Insert a proof into the database
    const listKey = 'someListKey';
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
      txidIndex: 59,
      txMerkleroot: 'txMerkleroot',
      blindedCommitmentInputs: [
        'blindedCommitmentInputs_0',
        'blindedCommitmentInputs_1',
      ],
      blindedCommitmentOutputs: [
        'blindedCommitmentOutputs_0',
        'blindedCommitmentOutputs_1',
      ],
      firstBlindedCommitmentInput: 'firstBlindedCommitmentInput',
    };

    // Insert the item
    await db.insertValidTransactProof(listKey, transactProofItem);

    // Check that the proof exists
    expect(
      await db.proofExists(
        listKey,
        transactProofItem.blindedCommitmentInputs[0],
      ),
    ).to.equal(true);

    // Delete the proof
    await db.deleteProof(listKey, transactProofItem.blindedCommitmentInputs[0]);

    // Check that the proof no longer exists
    expect(
      await db.proofExists(
        listKey,
        transactProofItem.blindedCommitmentInputs[0],
      ),
    ).to.equal(false);
  });
});
