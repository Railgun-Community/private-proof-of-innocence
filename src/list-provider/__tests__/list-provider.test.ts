import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NetworkName } from '@railgun-community/shared-models';
import * as WalletModule from '../../engine/wallet';
import { ShieldData } from '@railgun-community/wallet';
import { TestMockListProvider } from '../../tests/test-mock-list-provider.test';
import { DatabaseClient } from '../../database/database-client';
import { ShieldQueueDatabase } from '../../database/databases/shield-queue-database';
import { ListProvider } from '../list-provider';
import sinon from 'sinon';
import { ShieldQueueDBItem, ShieldStatus } from '../../models/database-types';
import { daysAgo } from '../../tests/util.test';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let listProvider: ListProvider;
let db: ShieldQueueDatabase;

describe('list-provider', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new ShieldQueueDatabase(networkName);
    await db.createCollectionIndices();
    listProvider = new TestMockListProvider('test-mock-list-provider');
  });

  beforeEach(async () => {
    await db.deleteAllItems_DANGEROUS();
  });

  it('Should add new shields to queue', async () => {
    const shieldDatas: ShieldData[] = [
      {
        txid: '0x1234',
        hash: '0x2345',
        timestamp: 1662421336, // Sept 5, 2022
      },
      {
        txid: '0x5678',
        hash: '0x6789',
        timestamp: Date.now(),
      },
    ];
    const stubGetAllShields = sinon
      .stub(WalletModule, 'getNewShieldsFromWallet')
      .resolves(shieldDatas);

    await listProvider.queueNewShields(networkName);

    const pendingShield: ShieldQueueDBItem = {
      txid: '0x1234',
      hash: '0x2345',
      timestamp: 1662421336, // Sept 5, 2022
      status: ShieldStatus.Pending,
      lastValidatedTimestamp: null,
    };
    await expect(db.getPendingShields(daysAgo(7))).to.eventually.deep.equal([
      pendingShield,
    ]);

    stubGetAllShields.restore();
  });
});
