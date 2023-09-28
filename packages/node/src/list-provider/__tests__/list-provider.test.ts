import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NetworkName } from '@railgun-community/shared-models';
import * as WalletModule from '../../engine/wallet';
import * as TxReceiptModule from '../../rpc-providers/tx-receipt';
import { ShieldData } from '@railgun-community/wallet';
import { TestMockListProviderExcludeSingleAddress } from '../../tests/list-providers/test-mock-list-provider-exclude-single-address.test';
import { DatabaseClient } from '../../database/database-client-init';
import { ShieldQueueDatabase } from '../../database/databases/shield-queue-database';
import { ListProvider } from '../list-provider';
import sinon, { SinonStub } from 'sinon';
import { ShieldQueueDBItem, ShieldStatus } from '../../models/database-types';
import { TransactionReceipt } from 'ethers';
import {
  MOCK_EXCLUDED_ADDRESS_1,
  MOCK_LIST_KEYS,
} from '../../tests/mocks.test';
import { ListProviderPOIEventQueue } from '../list-provider-poi-event-queue';
import { calculateShieldBlindedCommitment } from '../../util/shield-blinded-commitment';
import { daysAgo } from '../../util/time-ago';

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
    listProvider = new TestMockListProviderExcludeSingleAddress(
      MOCK_LIST_KEYS[0],
    );
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
        commitmentHash: '0x2345',
        npk: '0x3456',
        timestamp: 1662421336, // Sept 5, 2022
        blockNumber: 123436,
        utxoTree: 0,
        utxoIndex: 3,
      },
      {
        txid: '0x5678',
        commitmentHash: '0x6789',
        npk: '0x7890',
        timestamp: Date.now(),
        blockNumber: 123436,
        utxoTree: 0,
        utxoIndex: 4,
      },
    ];
    createStubGetAllShields(shieldDatas);

    await listProvider.queueNewUnknownShields(networkName);

    const unknownShield: ShieldQueueDBItem = {
      txid: '0x1234',
      commitmentHash: '0x2345',
      blindedCommitment: calculateShieldBlindedCommitment(shieldDatas[0]),
      npk: '0x3456',
      timestamp: 1662421336, // Sept 5, 2022
      status: ShieldStatus.Unknown,
      lastValidatedTimestamp: null,
      blockNumber: 123436,
      utxoTree: 0,
      utxoIndex: 3,
    };
    await expect(
      db.getShields(ShieldStatus.Unknown, daysAgo(3)),
    ).to.eventually.deep.equal([unknownShield]);
  });

  it('Should categorize and validate queued shield batch', async () => {
    const shieldDatas: ShieldData[] = [
      // will be Allowed
      {
        txid: '0x1234',
        commitmentHash: '0x2345',
        npk: '0x3456',
        timestamp: 1662421336, // Sept 5, 2022
        blockNumber: 123436,
        utxoTree: 0,
        utxoIndex: 3,
      },
      // will be Blocked
      {
        txid: '0x5678',
        commitmentHash: '0x6789',
        npk: '0x7890',
        timestamp: 1662421336, // Sept 5, 2022
        blockNumber: 123436,
        utxoTree: 0,
        utxoIndex: 4,
      },
    ];
    createStubGetAllShields(shieldDatas);

    await listProvider.queueNewUnknownShields(networkName);

    const unknownShields = await db.getShields(
      ShieldStatus.Unknown,
      daysAgo(3),
    );
    expect(unknownShields.length).to.equal(2);

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

    const listProviderEventQueueSpy = sinon.spy(
      ListProviderPOIEventQueue,
      'queueUnsignedPOIShieldEvent',
    );

    await listProvider.categorizeUnknownShields(networkName);

    const pendingShields = await db.getShields(ShieldStatus.Pending);
    expect(pendingShields.length).to.equal(2);

    await listProvider.validateNextPendingShieldBatch(networkName);
    const allowedShields = await db.getShields(ShieldStatus.Allowed);
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
        blindedCommitment:
          '0x1f82cb9af8e30f1b5c96b53333be320e8c72e5ca702d5b8a953d8caaa743fa8b',
        commitmentHash: '0x2345',
        txid: '0x1234',
        npk: '0x3456',
        timestamp: 1662421336,
        status: ShieldStatus.Allowed,
        lastValidatedTimestamp: null,
        blockNumber: 123436,
        utxoTree: 0,
        utxoIndex: 3,
      },
    ]);

    txReceiptMock.restore();
    timestampMock.restore();

    expect(listProviderEventQueueSpy.calledOnce).to.equal(true);
    listProviderEventQueueSpy.restore();
  });
});
