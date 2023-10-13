import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { LegacyTransactProofMempoolDatabase } from '../legacy-transact-proof-mempool-database';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';
import { LegacyTransactProofMempoolDBItem } from '../../../models/database-types';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let db: LegacyTransactProofMempoolDatabase;

describe('legacy-transact-proof-mempool-database', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new LegacyTransactProofMempoolDatabase(networkName, txidVersion);
    await db.createCollectionIndices();
  });

  beforeEach(async () => {
    await db.deleteAllItems_DANGEROUS();
  });

  it('Should create collection indices', async () => {
    const indexes = await db.listCollectionIndexes();

    const uniqueCombinedIndexExists = indexes.some(index => {
      return 'blindedCommitment' in index.key && index.unique === true;
    });

    expect(uniqueCombinedIndexExists).to.equal(true);
  });

  it('Should correctly initialize LegacyTransactProofMempoolDatabase', () => {
    expect(db).to.be.instanceOf(LegacyTransactProofMempoolDatabase);
  });

  it('Should insert and get a valid legacy transact proof', async () => {
    const legacyTransactProofItem: LegacyTransactProofMempoolDBItem = {
      txidIndex: '1',
      npk: '0x6789',
      value: '10',
      tokenHash: '0x1234',
      blindedCommitment: '0xabcd',
    };

    await db.insertLegacyTransactProof(legacyTransactProofItem);

    expect(await db.legacyProofExists('0xabcd')).to.equal(true);
  });
});
