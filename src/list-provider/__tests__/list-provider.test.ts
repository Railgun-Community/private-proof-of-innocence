import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NetworkName } from '@railgun-community/shared-models';
import * as WalletModule from '../../engine/wallet';
import * as TxReceiptModule from '../../rpc-providers/tx-receipt';
import { ShieldData } from '@railgun-community/wallet';
import { TestMockListProvider } from '../../tests/test-mock-list-provider.test';
import { DatabaseClient } from '../../database/database-client';
import { ShieldQueueDatabase } from '../../database/databases/shield-queue-database';
import { ListProvider } from '../list-provider';
import sinon, { SinonStub } from 'sinon';
import { ShieldQueueDBItem, ShieldStatus } from '../../models/database-types';
import { daysAgo } from '../../tests/util.test';
import { TransactionReceipt } from 'ethers';
import { MOCK_EXCLUDED_ADDRESS_1 } from '../../tests/mocks.test';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let listProvider: ListProvider;
let db: ShieldQueueDatabase;

let stubGetAllShields: SinonStub;

const createStubGetAllShields = (shieldDatas: ShieldData[]) => {
  stubGetAllShields = sinon
    .stub(WalletModule, 'getNewShieldsFromWallet')
    .resolves(shieldDatas);
};

describe('list-provider', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new ShieldQueueDatabase(networkName);
    await db.createCollectionIndices();
    listProvider = new TestMockListProvider('test-mock-list-provider');
  });

  afterEach(() => {
    stubGetAllShields?.restore();
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
    createStubGetAllShields(shieldDatas);

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
  });

  it('Should validate queued shield batch', async () => {
    const shieldDatas: ShieldData[] = [
      {
        txid: '0x1234',
        hash: '0x2345',
        timestamp: 1662421336, // Sept 5, 2022
      },
      {
        txid: '0x5678',
        hash: '0x6789',
        timestamp: 1662421336, // Sept 5, 2022
      },
    ];
    createStubGetAllShields(shieldDatas);

    await listProvider.queueNewShields(networkName);

    const pendingShields = await db.getPendingShields(daysAgo(7));
    expect(pendingShields.length).to.equal(2);

    // Should be Allowed
    const txReceipt1 = { from: '0xabcd' } as TransactionReceipt;

    // Should be Blocked
    const txReceipt2 = {
      from: MOCK_EXCLUDED_ADDRESS_1,
    } as TransactionReceipt;

    const txReceiptMock = sinon
      .stub(TxReceiptModule, 'getTransactionReceipt')
      .callsFake(async (networkName: NetworkName, txid: string) => {
        switch (txid) {
          case '0x1234':
            return txReceipt1;
          case '0x5678':
            return txReceipt2;
        }
        throw new Error('Unrecognized txid');
      });

    const timestampMock = sinon
      .stub(TxReceiptModule, 'getTimestampFromTransactionReceipt')
      .resolves(1662421336);

    await listProvider.validateNextQueuedShieldBatch(networkName);

    const allowedShields = await db.getAllowedShields();
    expect(allowedShields.length).to.equal(1);

    expect(allowedShields[0].lastValidatedTimestamp).to.be.lessThanOrEqual(
      Date.now(),
    );
    expect(allowedShields[0].lastValidatedTimestamp).to.be.greaterThan(
      Date.now() - 1000,
    );
    allowedShields[0].lastValidatedTimestamp = null;

    expect(allowedShields).to.deep.equal([
      {
        txid: '0x1234',
        hash: '0x2345',
        timestamp: 1662421336,
        status: ShieldStatus.Allowed,
        lastValidatedTimestamp: null,
      },
    ]);

    txReceiptMock.restore();
    timestampMock.restore();
  });
});
