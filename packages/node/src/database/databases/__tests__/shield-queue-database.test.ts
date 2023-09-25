/// <reference types="../../../types/index" />
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
import { getShieldQueueStatus } from '../../../shields/shield-queue';
import { calculateShieldBlindedCommitment } from '../../../util/shield-blinded-commitment';
import { daysAgo } from '../../../util/time-ago';

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
    const txidIndexExists = indexes.some(index => {
      return 'key' in index && 'txid' in index.key;
    });

    // Check if an index exists for the 'commitmentHash' field with a unique constraint
    const commitmentHashIndexExists = indexes.some(index => {
      return 'key' in index && 'commitmentHash' in index.key;
    });

    // Check if an index exists for the 'utxoTree' and 'utxoIndex' field with a unique constraint
    const utxoTreeAndIndexIndexExists = indexes.some(index => {
      return (
        'key' in index &&
        'utxoTree' in index.key &&
        'utxoIndex' in index.key &&
        index.unique === true
      );
    });

    // Check if an index exists for the 'timestamp' field
    const timestampIndexExists = indexes.some(index => {
      return 'key' in index && 'timestamp' in index.key;
    });

    // Check if an index exists for the 'status' field
    const statusIndexExists = indexes.some(index => {
      return 'key' in index && 'status' in index.key;
    });

    // Assert that each index exists
    expect(txidIndexExists).to.equal(true);
    expect(commitmentHashIndexExists).to.equal(true);
    expect(utxoTreeAndIndexIndexExists).to.equal(true);
    expect(timestampIndexExists).to.equal(true);
    expect(statusIndexExists).to.equal(true);
  });

  it('Should insert items and query from shield queue database', async () => {
    const now = Date.now();

    // No shields in queue to begin
    await expect(
      db.getShields(ShieldStatus.Unknown, now),
    ).to.eventually.deep.equal([]);

    const pendingShield1: ShieldData = {
      txid: '0x1234',
      commitmentHash: '0x5678',
      npk: '0x0000',
      timestamp: now,
      blockNumber: 123456,
      utxoTree: 0,
      utxoIndex: 5,
    };
    await db.insertUnknownShield(pendingShield1);

    const fourDaysAgo = daysAgo(4);
    const pendingShield2: ShieldData = {
      txid: '0x9876',
      commitmentHash: '0x5432',
      npk: '0x0000',
      timestamp: fourDaysAgo,
      blockNumber: 123456,
      utxoTree: 0,
      utxoIndex: 6,
    };
    await db.insertUnknownShield(pendingShield2);

    // Will skip insert because timestamp is undefined
    const pendingShield3: ShieldData = {
      txid: '0x123456',
      commitmentHash: '0x567890',
      npk: '0x0000',
      timestamp: undefined,
      blockNumber: 123436,
      utxoTree: 0,
      utxoIndex: 7,
    };
    await db.insertUnknownShield(pendingShield3);

    const shieldQueueItem2: ShieldQueueDBItem = {
      ...pendingShield2,
      blindedCommitment: calculateShieldBlindedCommitment(pendingShield2),
      timestamp: fourDaysAgo,
      status: ShieldStatus.Unknown,
      lastValidatedTimestamp: null,
    };
    await expect(
      db.getShields(ShieldStatus.Unknown, daysAgo(3)),
    ).to.eventually.deep.equal([shieldQueueItem2]);

    const unknownCount = await db.getCount(ShieldStatus.Unknown);
    expect(unknownCount).to.equal(2); // 2 unknown status shields

    const pendingCount = await db.getCount(ShieldStatus.Pending);
    expect(pendingCount).to.equal(0); // No pending status shields

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
      pending: 0,
      unknown: 2,
      latestPendingShield: shieldQueueStatus.latestPendingShield,
    });
  });

  it('Should update unknown shield status', async () => {
    const now = Date.now();

    // No shields in queue to begin
    await expect(
      db.getShields(ShieldStatus.Unknown, now),
    ).to.eventually.deep.equal([]);

    const fourDaysAgo = daysAgo(4);
    const unknownShieldExpired: ShieldData = {
      txid: '0x9876',
      commitmentHash: '0x5432',
      npk: '0x0000',
      utxoTree: 0,
      utxoIndex: 5,
      timestamp: fourDaysAgo,
      blockNumber: 123436,
    };
    await db.insertUnknownShield(unknownShieldExpired);

    const shieldQueueItemExpired: ShieldQueueDBItem = {
      txid: '0x9876',
      commitmentHash: '0x5432',
      blindedCommitment: calculateShieldBlindedCommitment(unknownShieldExpired),
      npk: '0x0000',
      timestamp: fourDaysAgo,
      status: ShieldStatus.Unknown,
      lastValidatedTimestamp: null,
      blockNumber: 123436,
      utxoTree: 0,
      utxoIndex: 5,
    };
    await expect(
      db.getShields(ShieldStatus.Unknown, daysAgo(3)),
    ).to.eventually.deep.equal([shieldQueueItemExpired]);

    // Set to "Allowed"
    await db.updateShieldStatus(shieldQueueItemExpired, ShieldStatus.Allowed);

    await expect(
      db.getShields(ShieldStatus.Pending, daysAgo(3)),
    ).to.eventually.deep.equal([]);

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
        ...shieldQueueItemExpired,
        status: ShieldStatus.Allowed,
        lastValidatedTimestamp: null,
      },
    ]);

    // Set to "Blocked"
    await db.updateShieldStatus(shieldQueueItemExpired, ShieldStatus.Blocked);

    const allowedShields2 = await db.getShields(ShieldStatus.Allowed);
    expect(allowedShields2.length).to.equal(0);
  });

  it('Should get the latest pending shield', async () => {
    // Insert pending shields with different timestamps
    const pendingShield1: ShieldData = {
      txid: '0x1234',
      commitmentHash: '0x5678',
      npk: '0x0000',
      utxoTree: 0,
      utxoIndex: 5,
      timestamp: Date.now() - 2000, // 2 seconds ago
      blockNumber: 123456,
    };
    await db.insertUnknownShield(pendingShield1);

    const pendingShield2: ShieldData = {
      txid: '0x9876',
      commitmentHash: '0x5432',
      npk: '0x0000',
      utxoTree: 0,
      utxoIndex: 6,
      timestamp: Date.now() - 1000, // 1 second ago
      blockNumber: 123456,
    };
    await db.insertUnknownShield(pendingShield2);

    // Get the latest shield
    const latestShield: Optional<ShieldQueueDBItem> =
      await db.getLatestUnknownOrPendingShield();

    // Validate returned shield is latest one based on timestamp
    expect(latestShield?.txid).to.equal(pendingShield2.txid);
    expect(latestShield?.commitmentHash).to.equal(
      pendingShield2.commitmentHash,
    );
    expect(latestShield?.timestamp).to.equal(pendingShield2.timestamp);

    // Delete all pending shields
    await db.deleteAllItems_DANGEROUS();

    // Validate latestShield now returns undefined
    const latestShieldAfterDeletion =
      await db.getLatestUnknownOrPendingShield();
    expect(latestShieldAfterDeletion).to.be.undefined;
  });
});
