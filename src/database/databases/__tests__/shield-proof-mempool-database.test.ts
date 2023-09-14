import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ShieldProofMempoolDatabase } from '../shield-proof-mempool-database';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';
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
        const indices = await db.listCollectionIndexes();

        const indexFieldExists = indices.some(index => {
            return 'key' in index && 'commitmentHash' in index.key && index.unique === true;
        });

        expect(indexFieldExists).to.equal(true);
    });

    it('Should insert and get a valid shield proof mempool item', async () => {
        const shieldProofMempoolItem: ShieldProofMempoolDBItem = {
            snarkProof: {
                pi_a: ['somePi_a1', 'somePi_a2'],
                pi_b: [['somePi_b11', 'somePi_b12'], ['somePi_b21', 'somePi_b22']],
                pi_c: ['somePi_c1', 'somePi_c2'],
            },
            commitmentHash: 'someCommitmentHash',
            blindedCommitment: 'someBlindedCommitment',
        };

        // Insert the item
        await db.insertValidShieldProof(shieldProofMempoolItem);

        // Fetch the item
        const fetchedItem = await db.getShieldProof(shieldProofMempoolItem.commitmentHash);
        expect(fetchedItem).to.not.be.null;
        expect(fetchedItem).to.not.be.undefined;

        if (fetchedItem) {
            expect(fetchedItem.commitmentHash).to.equal(shieldProofMempoolItem.commitmentHash);
            expect(fetchedItem.blindedCommitment).to.equal(shieldProofMempoolItem.blindedCommitment);
            expect(fetchedItem.snarkProof).to.deep.equal(shieldProofMempoolItem.snarkProof);
        }
    });
});