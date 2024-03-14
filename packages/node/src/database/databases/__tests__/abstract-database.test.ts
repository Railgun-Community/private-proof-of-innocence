import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';
import { DatabaseClientStorage } from '../../database-client-storage';
import { TestDatabase } from '../test-database';
import { TestDBItem } from '../../../models/database-types';
import { MongoError } from 'mongodb';
import sinon from 'sinon';
import { Config } from '../../../config/config';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let db: TestDatabase;

describe('abstract-database', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new TestDatabase(networkName, txidVersion);
    await db.createCollectionIndices();
  });

  it('Should throw error if DatabaseClient is not initialized', async () => {
    DatabaseClientStorage.client = undefined;

    expect(() => new TestDatabase(networkName, txidVersion)).to.throw(
      'DatabaseClient not initialized',
    );

    const client = await DatabaseClient.init(); // Re-initialize for the following tests

    // Check if the client is defined indicating successful health check
    expect(client).to.be.ok;
  });

  it('Should correctly initialize TestDatabase', async () => {
    expect(db).to.be.instanceOf(TestDatabase);
  });

  it('Should create collection indices', async () => {
    // List all indexes for the collection
    const indexes = await db.listCollectionIndexes();

    // Check that an index on 'test' exists
    const indexExists = indexes.some(index => {
      return 'key' in index && 'test' in index.key && index.unique === true;
    });

    expect(indexExists).to.be.true;

    expect(await db.indexExists(['test'], false)).to.equal(false);
    expect(await db.indexExists(['test'], true)).to.equal(true);
    expect(await db.indexExists(['test', 'test2'], false)).to.equal(true);
    expect(await db.indexExists(['test', 'test2'], true)).to.equal(false);

    await db.dropIndex(['test', 'test2']);
    expect(await db.indexExists(['test', 'test2'], false)).to.equal(false);
  });

  it('Should create an index with a custom name', async () => {
    // Create an index with a custom name in the TestDatabase
    await db.createCustomNameIndexForTest();

    // List all indexes for the collection
    const indexes = await db.listCollectionIndexes();

    // Check if an index with the custom name exists
    const indexExists = indexes.some(index => index.name === 'customIndexName');

    expect(indexExists).to.be.true;
  });

  it('Should throw error if combined length of collection and index name exceeds 64 characters', async () => {
    // Attempt to create an index with a long name in the TestDatabase
    await expect(db.createLongIndexForTest()).to.be.rejectedWith(
      'Index name veryBigAndLongIndexNameToForceFailurePart1_1_veryBigAndLongIndexNameToForceFailurePart2_1 is too long for collection Test',
    );
  });

  it('Should throw error on insertOne', async () => {
    // Create a stub for the MongoDB collection's insertOne method
    const stub = sinon.stub(db['collection'], 'insertOne');

    // Make the stub throw an error
    stub.throws(new MongoError('Some error'));

    // The insert operation should now reject
    await expect(db.insert({ test: 'some data' })).to.be.rejectedWith(
      'Some error',
    );

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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
    DatabaseClientStorage.client = undefined;

    // Set the MONGODB_URL to undefined to simulate the condition
    Config.MONGODB_URL = undefined;

    // Now DatabaseClient.init should throw an error
    await expect(DatabaseClient.init()).to.be.rejectedWith(
      'Set MONGODB_URL as mongodb:// string',
    );

    // Restore the original MONGODB_URL
    Config.MONGODB_URL = originalUrl;
  });

  it('Should delete one item', async () => {
    const filter = { test: 'some data' };

    // Insert an item to delete
    await db.insert(filter);

    // Verify that the item was inserted
    const verifyItem = await db.getItem(filter);
    expect(verifyItem).to.not.be.null;
    expect(verifyItem).to.not.be.undefined;

    // Delete the item
    await db.delete(filter);

    // Verify that the item was deleted
    const deletedItem = await db.getItem(filter);
    expect(deletedItem).to.be.undefined;
  });
});
