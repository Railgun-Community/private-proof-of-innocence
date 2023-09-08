import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { StatusDatabase } from '../status-database';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client';
import { StatusDBItem } from '../../../models/database-types';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let db: StatusDatabase;

describe('StatusDatabase', () => {
    before(async () => {
        await DatabaseClient.init();
        db = new StatusDatabase(networkName);
      
        // Insert dummy document, ensures DB gets a namespace since is empty 
        await db.saveStatus(0);
      
        await db.createCollectionIndices();
    });

    // Clear the database before each test
    beforeEach(async () => {
        await db.deleteAllItems_DANGEROUS();
    });

    it('Should correctly initialize StatusDatabase', () => {
        expect(db).to.be.instanceOf(StatusDatabase);
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

    it('Should save and get status', async () => {
        const statusItem: StatusDBItem = {
            latestBlockScanned: 100,
        };

        // Insert the item
        await db.saveStatus(statusItem.latestBlockScanned);

        // Fetch the item
        const fetchedItem = await db.getStatus();
        expect(fetchedItem).to.not.be.null;
        expect(fetchedItem).to.not.be.undefined;

        if (fetchedItem) {
            expect(fetchedItem.latestBlockScanned).to.equal(100);
        }
    });
});

