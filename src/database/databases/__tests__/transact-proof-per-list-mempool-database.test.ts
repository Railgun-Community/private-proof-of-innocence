import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { TransactProofPerListMempoolDatabase } from '../transact-proof-per-list-mempool-database';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client';
import {
    TransactProofMempoolDBItem,
} from '../../../models/database-types';

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

    it('Should correctly initialize TransactProofPerListMempoolDatabase', () => {
        expect(db).to.be.instanceOf(TransactProofPerListMempoolDatabase);
    });

    it('Should not create additional collection indices', async () => {
        // Fetch all indexes for the collection
        const indexes = await db.getCollectionIndexes();

        // Filter out the default MongoDB index on the `_id` field
        const additionalIndexes = indexes.filter(index => {
            return !('key' in index && '_id' in index.key);
        });

        expect(additionalIndexes.length).to.equal(0);
    });

    it('Should insert and get a valid transact proof', async () => {
        const transactProofItem: TransactProofMempoolDBItem = {
            snarkProof: {
                a: 'someA',
                b: ['someB', 'someB'],
                c: 'someC',
            }
        };

        // Insert the item
        await db.insertValidTransactProof(transactProofItem);
    });
});