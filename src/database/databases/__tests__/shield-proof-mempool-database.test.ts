import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ShieldProofMempoolDatabase } from '../shield-proof-mempool-database';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client';
import { ShieldProofMempoolDBItem } from '../../../models/database-types';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let db: ShieldProofMempoolDatabase;

describe('ShieldProofMempoolDatabase', () => {
    before(async () => {
        await DatabaseClient.init();
        db = new ShieldProofMempoolDatabase(networkName);
        await db.createCollectionIndices();
    });

    // Clear the database before each test
    beforeEach(async () => {
        await db.deleteAllItems_DANGEROUS();
    });

    it('Should correctly initialize ShieldProofMempoolDatabase', () => {
        expect(db).to.be.instanceOf(ShieldProofMempoolDatabase);
    });

    it('Should create collection indices', async () => {
        const indices = await db.getCollectionIndexes();

        const indexFieldExists = indices.some(index => {
            return 'key' in index && 'commitmentHash' in index.key && index.unique === true;
        });

        expect(indexFieldExists).to.equal(true);
    });

    it('Should insert and get a valid shield proof mempool item', async () => {
        const shieldProofMempoolItem: ShieldProofMempoolDBItem = {
            snarkProof: {
                a: 'someA',
                b: ['someB', 'someB'],
                c: 'someC',
            },
            commitmentHash: 'someCommitmentHash',
        };

        // Insert the item
        await db.insertValidShieldProof(shieldProofMempoolItem);

        // Fetch the item
        const fetchedItem = await db.getShieldProof(shieldProofMempoolItem.commitmentHash);
        expect(fetchedItem).to.not.be.null;
        expect(fetchedItem).to.not.be.undefined;

        if (fetchedItem) {
            expect(fetchedItem.snarkProof.a).to.equal('someA');
            expect(fetchedItem.snarkProof.b).to.deep.equal(['someB', 'someB']);
            expect(fetchedItem.snarkProof.c).to.equal('someC');
            expect(fetchedItem.commitmentHash).to.equal('someCommitmentHash');
        }
    });
});