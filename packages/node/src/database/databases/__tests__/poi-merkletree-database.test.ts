import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { POIMerkletreeDatabase } from '../poi-merkletree-database';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let db: POIMerkletreeDatabase;

describe('poi-merkletree-database', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new POIMerkletreeDatabase(networkName, txidVersion);
    await db.createCollectionIndices();
  });

  beforeEach(async () => {
    await db.deleteAllItems_DANGEROUS();
  });

  it('Should correctly initialize POIMerkletreeDatabase', () => {
    expect(db).to.be.instanceOf(POIMerkletreeDatabase);
  });

  it('Should create collection indices', async () => {
    // List all indexes for the collection
    const indexes = await db.listCollectionIndexes();

    // Check that an index on 'listKey' and 'rootHash' exists
    const indexExists = indexes.some(index => {
      return (
        'key' in index &&
        'tree' in index.key &&
        'level' in index.key &&
        'index' in index.key &&
        'listKey' in index.key &&
        index.unique === true
      );
    });

    expect(indexExists).to.be.true;
  });
});
