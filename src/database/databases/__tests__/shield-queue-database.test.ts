import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database-client-init';
import { ShieldQueueDatabase } from '../shield-queue-database';
import { ShieldData } from '@railgun-community/wallet';
import {
  ShieldQueueDBItem,
  ShieldStatus,
} from '../../../models/database-types';
import { daysAgo } from '../../../tests/util.test';
import { getShieldQueueStatus } from '../../../shield-queue/shield-queue';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let db: ShieldQueueDatabase;

describe('shield-queue-database', () => {
  before(async () => {
    await DatabaseClient.init();
    db = new ShieldQueueDatabase(networkName);
    await db.createCollectionIndices();
  });

  beforeEach(async () => {
    await db.deleteAllItems_DANGEROUS();
  });

  it('Should create collection indices', async () => {
    // Fetch all indexes for the collection
    const indexes = await db.listCollectionIndexes();

    // Check if an index exists for the 'txid' field
    const txidIndexExists = indexes.some((index) => {
      return 'key' in index && 'txid' in index.key;
    });

    // Check if an index exists for the 'hash' field with a unique constraint
    const hashIndexExists = indexes.some((index) => {
      return 'key' in index && 'hash' in index.key && index.unique === true;
    });

    // Check if an index exists for the 'timestamp' field
    const timestampIndexExists = indexes.some((index) => {
      return 'key' in index && 'timestamp' in index.key;
    });

    // Check if an index exists for the 'status' field
    const statusIndexExists = indexes.some((index) => {
      return 'key' in index && 'status' in index.key;
    });

    // Assert that each index exists
    expect(txidIndexExists).to.equal(true);
    expect(hashIndexExists).to.equal(true);
    expect(timestampIndexExists).to.equal(true);
    expect(statusIndexExists).to.equal(true);
  });

  it('Should insert items and query from shield queue database', async () => {
    const now = Date.now();

    // No shields in queue to begin
    await expect(db.getPendingShields(now)).to.eventually.deep.equal([]);

    const pendingShield1: ShieldData = {
      txid: '0x1234',
      hash: '0x5678',
      timestamp: now,
      blockNumber: 123456,
    };
    await db.insertPendingShield(pendingShield1);

    const tenDaysAgo = daysAgo(10);
    const pendingShield2: ShieldData = {
      txid: '0x9876',
      hash: '0x5432',
      timestamp: tenDaysAgo,
      blockNumber: 123456,
    };
    await db.insertPendingShield(pendingShield2);

    // Will skip insert because timestamp is undefined
    const pendingShield3: ShieldData = {
      txid: '0x123456',
      hash: '0x567890',
      timestamp: undefined,
      blockNumber: 123436,
    };
    await db.insertPendingShield(pendingShield3);

    const shieldQueueItem2: ShieldQueueDBItem = {
      ...pendingShield2,
      timestamp: tenDaysAgo,
      status: ShieldStatus.Pending,
      lastValidatedTimestamp: null,
    };
    await expect(db.getPendingShields(daysAgo(7))).to.eventually.deep.equal([
      shieldQueueItem2,
    ]);

    const pendingCount = await db.getCount(ShieldStatus.Pending);
    expect(pendingCount).to.equal(2); // 2 pending status shields

    const allowedCount = await db.getCount(ShieldStatus.Allowed);
    expect(allowedCount).to.equal(0); // No allowed status shields

    const blockedCount = await db.getCount(ShieldStatus.Blocked);
    expect(blockedCount).to.equal(0); // No block status shields

    const shieldQueueStatus = await getShieldQueueStatus(networkName);
    expect(shieldQueueStatus.latestPendingShield).to.be.a('string');
    expect(shieldQueueStatus).to.deep.equal({
      addedPOI: 0,
      allowed: 0,
      blocked: 0,
      pending: 2,
      latestPendingShield: shieldQueueStatus.latestPendingShield,
    });
  });

  it('Should update pending shield status', async () => {
    const now = Date.now();

    // No shields in queue to begin
    await expect(db.getPendingShields(now)).to.eventually.deep.equal([]);

    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const pendingShieldExpired: ShieldData = {
      txid: '0x9876',
      hash: '0x5432',
      timestamp: tenDaysAgo,
      blockNumber: 123436,
    };
    await db.insertPendingShield(pendingShieldExpired);

    const shieldQueueItemExpired: ShieldQueueDBItem = {
      txid: '0x9876',
      hash: '0x5432',
      timestamp: tenDaysAgo,
      status: ShieldStatus.Pending,
      lastValidatedTimestamp: null,
      blockNumber: 123436,
    };
    await expect(db.getPendingShields(daysAgo(7))).to.eventually.deep.equal([
      shieldQueueItemExpired,
    ]);

    // Set to "Allowed"
    await db.updateShieldStatus(shieldQueueItemExpired, true);

    await expect(db.getPendingShields(daysAgo(7))).to.eventually.deep.equal([]);

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
        ...shieldQueueItemExpired,
        status: ShieldStatus.Allowed,
        lastValidatedTimestamp: null,
      },
    ]);

    // Set to "Blocked"
    await db.updateShieldStatus(shieldQueueItemExpired, false);

    const allowedShields2 = await db.getAllowedShields();
    expect(allowedShields2.length).to.equal(0);
  });

  it('Should get the latest pending shield', async () => {
    // Insert pending shields with different timestamps
    const pendingShield1: ShieldData = {
      txid: '0x1234',
      hash: '0x5678',
      timestamp: Date.now() - 2000, // 2 seconds ago
      blockNumber: 123456,
    };
    await db.insertPendingShield(pendingShield1);

    const pendingShield2: ShieldData = {
      txid: '0x9876',
      hash: '0x5432',
      timestamp: Date.now() - 1000, // 1 second ago
      blockNumber: 123456,
    };
    await db.insertPendingShield(pendingShield2);

    // Get the latest pending shield
    const latestPendingShield = await db.getLatestPendingShield();

    // Validate returned shield is latest one based on timestamp
    expect(latestPendingShield?.txid).to.equal(pendingShield2.txid);
    expect(latestPendingShield?.hash).to.equal(pendingShield2.hash);
    expect(latestPendingShield?.timestamp).to.equal(pendingShield2.timestamp);

    // Delete all pending shields
    await db.deleteAllItems_DANGEROUS();

    // Validate latestPendingShield now returns undefined
    const latestPendingShieldAfterDeletion = await db.getLatestPendingShield();
    expect(latestPendingShieldAfterDeletion).to.be.undefined;
  });
});
