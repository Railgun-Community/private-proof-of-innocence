import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client';
import { TestDatabase } from '../test-database';
import {
    TestDBItem,
} from '../../../models/database-types';
import { MongoError } from 'mongodb';
import sinon from 'sinon';
import { Config } from '../../../config/config';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

describe('abstract-database', () => {
    before(async () => {
        await DatabaseClient.init();
    });

    let db: TestDatabase;

    it('Should throw error if DatabaseClient is not initialized', async () => {
        DatabaseClient.client = undefined;
        expect(() => new TestDatabase(networkName)).to.throw('DatabaseClient not initialized');
        await DatabaseClient.init();  // Re-initialize for the following tests
    });

    it('Should correctly initialize TestDatabase', async () => {
        db = new TestDatabase(networkName);
        expect(db).to.be.instanceOf(TestDatabase);
        await db.createCollectionIndices();
    });

    it('Should create collection indices', async () => {
        // List all indexes for the collection
        const indexes = await db.getCollectionIndexes(); // have to access through the wrapper

        // Check that an index on 'test' exists
        const indexExists = indexes.some(index => {
            return (
                'key' in index &&
                'test' in index.key &&
                index.unique === true
            );
        });

        expect(indexExists).to.be.true;
    });


    it('Should throw error on insertOne', async () => {
        // Create a stub for the MongoDB collection's insertOne method
        const stub = sinon.stub(db['collection'], 'insertOne');

        // Make the stub throw an error
        stub.throws(new MongoError('Some error'));

        // The insert operation should now reject
        await expect(db.insert({ test: 'some data' })).to.be.rejectedWith('Some error');

        // Restore the original method
        stub.restore();
    });

    it('Should ignore duplicate key error in onInsertError', async () => {
        // Create a MongoError with code 11000 (duplicate key)
        const duplicateKeyError = new MongoError('Duplicate key error');
        duplicateKeyError.code = 11000;

        // Define a variable to capture any errors thrown by onInsertError
        let thrownError = null;

        try {
            // Call the onInsertError method directly with the duplicate key error
            db['onInsertError'](duplicateKeyError);
        } catch (err) {
            thrownError = err;
        }

        // Verify that no error was thrown
        expect(thrownError).to.be.null;
    });

    it('Should throw error on failed update', async () => {
        const filter = { test: 'nonexistent' };
        const item: Partial<TestDBItem> = { test: 'newvalue' };
        await expect(db.update(filter, item)).to.be.rejected; // Assumes updateOne will throw if item doesn't exist
    });

    it('Should throw an error if MONGODB_URL is not set', async () => {
        // Save the original MONGODB_URL to restore it later
        const originalUrl = Config.MONGODB_URL;

        // Set DatabaseClient.client to undefined to make sure init() doesn't return early
        DatabaseClient.client = undefined;

        // Set the MONGODB_URL to undefined to simulate the condition
        Config.MONGODB_URL = undefined;

        // Now DatabaseClient.init should throw an error
        await expect(DatabaseClient.init()).to.be.rejectedWith('Set MONGODB_URL as mongodb:// string');

        // Restore the original MONGODB_URL
        Config.MONGODB_URL = originalUrl;
    });
});
