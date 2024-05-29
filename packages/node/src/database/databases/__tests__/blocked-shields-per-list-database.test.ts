import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { BlockedShieldsPerListDatabase } from '../blocked-shields-per-list-database';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';
import { MOCK_LIST_KEYS } from '../../../tests/mocks.test';
import { SignedBlockedShield } from '../../../models/poi-types';
import { signBlockedShield } from '../../../util/ed25519';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumSepolia;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let db: BlockedShieldsPerListDatabase;

const listKey = MOCK_LIST_KEYS[0];

describe('blocked-shields-per-list-database', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new BlockedShieldsPerListDatabase(networkName, txidVersion);
    await db.createCollectionIndices();
  });

  // Clear the database before each test
  beforeEach(async () => {
    await db.deleteAllItems_DANGEROUS();
  });

  it('Should create collection indices', async () => {
    // Fetch all indexes for the collection
    const indexes = await db.listCollectionIndexes();

    // Check if a unique index exists for the combination of 'listKey' and 'blindedCommitment' fields
    const uniqueCombinedIndexExists = indexes.some(index => {
      return (
        'key' in index &&
        'listKey' in index.key &&
        'blindedCommitment' in index.key &&
        index.unique === true
      );
    });

    // Assert that the unique index exists
    expect(uniqueCombinedIndexExists).to.equal(true);
  });

  it('Should correctly initialize BlockedShieldsPerListDatabase', () => {
    expect(db).to.be.instanceOf(BlockedShieldsPerListDatabase);
  });

  it('Should insert and get a valid blocked shield', async () => {
    const blockedShieldData1 = {
      commitmentHash: '0x0000',
      blindedCommitment: '0x1111',
      blockReason: 'test',
    };
    const blockedShield1: SignedBlockedShield = {
      commitmentHash: blockedShieldData1.commitmentHash,
      blindedCommitment: blockedShieldData1.blindedCommitment,
      blockReason: blockedShieldData1.blockReason,
      signature: await signBlockedShield(
        blockedShieldData1.commitmentHash,
        blockedShieldData1.blindedCommitment,
        blockedShieldData1.blockReason,
      ),
    };

    // Insert the item
    await db.insertSignedBlockedShield(listKey, blockedShield1);

    // Check that the blocked shield exists
    expect(await db.isShieldBlockedByList(listKey, '0x1111')).to.equal(true);
  });
});
