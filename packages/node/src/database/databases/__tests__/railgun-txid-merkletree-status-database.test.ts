import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { RailgunTxidMerkletreeStatusDatabase } from '../railgun-txid-merkletree-status-database';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';
import { RailgunTxidMerkletreeStatusDBItem } from '../../../models/database-types';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let db: RailgunTxidMerkletreeStatusDatabase;

describe('railgun-txid-merkletree-status-database', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new RailgunTxidMerkletreeStatusDatabase(networkName);

    // Insert dummy document, ensures DB gets a namespace since is empty
    await db.saveValidatedTxidStatus(0, 'someRoot');

    await db.createCollectionIndices();
  });

  beforeEach(async () => {
    await db.deleteAllItems_DANGEROUS();
  });

  it('Should not create additional collection indices', async () => {
    // Fetch all indexes for the collection
    const indexes = await db.listCollectionIndexes();

    // Filter out the default MongoDB index on the `_id` field
    const additionalIndexes = indexes.filter((index) => {
      return !('key' in index && '_id' in index.key);
    });

    expect(additionalIndexes.length).to.equal(0);
  });

  it('Should correctly initialize RailgunTxidMerkletreeStatusDatabase', () => {
    expect(db).to.be.instanceOf(RailgunTxidMerkletreeStatusDatabase);
  });

  it('Should insert, get, and update a valid RailgunTxidMerkletreeStatusDBItem', async () => {
    const statusItem: RailgunTxidMerkletreeStatusDBItem = {
      validatedTxidIndex: 10,
      validatedTxidMerkleroot: 'someRoot',
    };

    // Save the status
    await db.saveValidatedTxidStatus(
      statusItem.validatedTxidIndex,
      statusItem.validatedTxidMerkleroot,
    );

    // Fetch the status
    const fetchedItem = await db.getStatus();
    expect(fetchedItem).to.not.be.null;
    expect(fetchedItem).to.not.be.undefined;

    if (fetchedItem !== null && fetchedItem !== undefined) {
      expect(fetchedItem.validatedTxidIndex).to.equal(
        statusItem.validatedTxidIndex,
      );
      expect(fetchedItem.validatedTxidMerkleroot).to.equal(
        statusItem.validatedTxidMerkleroot,
      );
    }

    // Update the status
    await db.saveValidatedTxidStatus(20, 'newRoot');

    // Fetch the updated status
    const updatedItem = await db.getStatus();
    expect(updatedItem).to.not.be.null;
    expect(updatedItem).to.not.be.undefined;

    if (updatedItem !== null && updatedItem !== undefined) {
      expect(updatedItem.validatedTxidIndex).to.equal(20);
      expect(updatedItem.validatedTxidMerkleroot).to.equal('newRoot');
    }
  });
});
