import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { POIHistoricalMerklerootDatabase } from '../poi-historical-merkleroot-database';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';
import { MOCK_LIST_KEYS } from '../../../tests/mocks.test';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let db: POIHistoricalMerklerootDatabase;

const listKey = MOCK_LIST_KEYS[0];

describe('poi-historical-merkleroot-database', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new POIHistoricalMerklerootDatabase(networkName, txidVersion);
    await db.createCollectionIndices();
  });

  beforeEach(async () => {
    await db.deleteAllItems_DANGEROUS();
  });

  it('Should create collection indices', async () => {
    // List all indexes for the collection
    const indexes = await db.listCollectionIndexes();

    // Check that an index on 'listKey' and 'rootHash' exists
    const indexExists = indexes.some(index => {
      return (
        'key' in index &&
        'listKey' in index.key &&
        'rootHash' in index.key &&
        index.unique === true
      );
    });

    expect(indexExists).to.be.true;
  });

  it('Should insert items and query from merkleroot database', async () => {
    const merklerootA = '0x1234';
    const merklerootB = '0x5678';

    await expect(db.merklerootExists(listKey, merklerootA)).to.eventually.equal(
      false,
      "DB should not contain merklerootA before it's inserted",
    );
    await expect(db.merklerootExists(listKey, merklerootB)).to.eventually.equal(
      false,
    );

    const globalLeafIndex = 0;
    await db.insertMerkleroot(listKey, globalLeafIndex, merklerootA);

    await expect(db.merklerootExists(listKey, merklerootA)).to.eventually.equal(
      true,
    );
    expect(
      (await db.getMerklerootByGlobalLeafIndex(listKey, globalLeafIndex))
        ?.rootHash,
    ).to.equal(merklerootA);
    await expect(
      db.allMerklerootsExist(listKey, [merklerootA]),
    ).to.eventually.equal(true);
    await expect(db.merklerootExists(listKey, merklerootB)).to.eventually.equal(
      false,
    );
    await expect(
      db.merklerootExists('wrong-key', merklerootA),
    ).to.eventually.equal(false);
  });

  // async insertMerkleroot(listKey: string, rootHash: string): Promise<void> {
  //   const item: POIHistoricalMerklerootDBItem = {
  //     listKey,
  //     rootHash,
  //   };
  //   await this.insertOne(item);
  // }

  // async merklerootExists(listKey: string, rootHash: string): Promise<boolean> {
  //   return this.exists({ listKey, rootHash });
  // }

  // async allMerklerootsExist(
  //   listKey: string,
  //   rootHashes: string[],
  // ): Promise<boolean> {
  //   const filter: Filter<POIHistoricalMerklerootDBItem> = {
  //     listKey,
  //     rootHash: { $in: rootHashes },
  //   };
  //   const count = await this.count(filter);
  //   return count === rootHashes.length;
  // }

  it('Should have the correct merkle root', async () => {
    // Insert the merkle root
    const merkleroot = '0x1234';

    await db.insertMerkleroot(listKey, 0, merkleroot);

    // Check that the merkle root exists
    await expect(db.merklerootExists(listKey, merkleroot)).to.eventually.equal(
      true,
    );

    // Check that the merkle root does not exist for a different list key
    await expect(
      db.merklerootExists('wrong-key', merkleroot),
    ).to.eventually.equal(false);

    // Check that the merkle root does not exist for a different merkle root
    await expect(db.merklerootExists(listKey, '0x5678')).to.eventually.equal(
      false,
    );

    // Insert another merkle root
    const merkleroot2 = '0x5678';
    await db.insertMerkleroot(listKey, 1, merkleroot2);

    // Check all merkle roots exist
    await expect(
      db.allMerklerootsExist(listKey, [merkleroot, merkleroot2]),
    ).to.eventually.equal(true);

    expect(
      (await db.getMerklerootByGlobalLeafIndex(listKey, 1))?.rootHash,
    ).to.equal(merkleroot2);
  });
});
