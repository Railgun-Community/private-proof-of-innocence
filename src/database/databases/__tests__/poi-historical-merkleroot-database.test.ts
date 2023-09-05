import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { POIHistoricalMerklerootDatabase } from '../poi-historical-merkleroot-database';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

describe('poi-historical-merkleroot-database', () => {
  before(async () => {
    await DatabaseClient.init();
  });

  it('Should insert items and query from merkleroot database', async () => {
    const db = new POIHistoricalMerklerootDatabase(networkName);
    await db.deleteAllItems_DANGEROUS();

    await db.createCollectionIndex();

    const merklerootA = '0x1234';
    const merklerootB = '0x5678';

    await expect(db.containsMerkleroot(merklerootA)).to.eventually.equal(
      false,
      "DB should not contain merklerootA before it's inserted",
    );
    await expect(db.containsMerkleroot(merklerootB)).to.eventually.equal(false);

    await db.insertMerkleroot(merklerootA);

    await expect(db.containsMerkleroot(merklerootA)).to.eventually.equal(true);
    await expect(db.containsMerkleroot(merklerootB)).to.eventually.equal(false);
  });
});
