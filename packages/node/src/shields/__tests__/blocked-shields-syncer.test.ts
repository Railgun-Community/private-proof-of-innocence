import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database/database-client-init';
import { BlockedShieldsCache } from '../blocked-shields-cache';
import { POINodeBloomFilter } from '../../util/poi-node-bloom-filters';
import { BlockedShieldsPerListDatabase } from '../../database/databases/blocked-shields-per-list-database';
import { BlockedShieldsSyncer } from '../blocked-shields-syncer';
import { SignedBlockedShield } from '../../models/poi-types';
import { getListPublicKey, signBlockedShield } from '../../util/ed25519';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;
let listKey: string;

let blockedShieldsDB: BlockedShieldsPerListDatabase;

describe('blocked-shields-syncer', () => {
  before(async () => {
    listKey = await getListPublicKey();

    await DatabaseClient.init();
    blockedShieldsDB = new BlockedShieldsPerListDatabase(
      networkName,
      txidVersion,
    );
  });

  beforeEach(async () => {
    await blockedShieldsDB.deleteAllItems_DANGEROUS();
    BlockedShieldsCache.clearCache_FOR_TEST_ONLY();
  });
  afterEach(async () => {
    await blockedShieldsDB.deleteAllItems_DANGEROUS();
    BlockedShieldsCache.clearCache_FOR_TEST_ONLY();
  });

  after(() => {});

  it('Should only add valid blocked shields', async () => {
    const blockedShieldData = {
      commitmentHash: '0x0000',
      blindedCommitment: '0x1111',
      blockReason: 'test',
    };
    const signedBlockedShield: SignedBlockedShield = {
      commitmentHash: blockedShieldData.commitmentHash,
      blindedCommitment: blockedShieldData.blindedCommitment,
      blockReason: blockedShieldData.blockReason,
      signature: await signBlockedShield(
        blockedShieldData.commitmentHash,
        blockedShieldData.blindedCommitment,
        blockedShieldData.blockReason,
      ),
    };

    // 1. THROW: signature fails verification.
    await expect(
      BlockedShieldsSyncer.addSignedBlockedShield(
        listKey,
        networkName,
        txidVersion,
        {
          ...signedBlockedShield,
          signature: '1234',
        },
      ),
    ).to.be.rejectedWith('Signature invalid for blocked shield');

    // 2. SUCCESS: snark verifies and commitmentHash recognized.

    await BlockedShieldsSyncer.addSignedBlockedShield(
      listKey,
      networkName,
      txidVersion,
      signedBlockedShield,
    );
    await expect(
      blockedShieldsDB.isShieldBlockedByList(
        listKey,
        signedBlockedShield.blindedCommitment,
      ),
    ).to.eventually.equal(true);
  });

  it('Should add to cache and get bloom-filtered blocked shields', async () => {
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
    const blockedShieldData2 = {
      commitmentHash: '0x1234',
      blindedCommitment: '0x5678',
      blockReason: 'another',
    };
    const blockedShield2: SignedBlockedShield = {
      commitmentHash: blockedShieldData2.commitmentHash,
      blindedCommitment: blockedShieldData2.blindedCommitment,
      blockReason: blockedShieldData2.blockReason,
      signature: await signBlockedShield(
        blockedShieldData2.commitmentHash,
        blockedShieldData2.blindedCommitment,
        blockedShieldData2.blockReason,
      ),
    };

    await BlockedShieldsSyncer.addSignedBlockedShield(
      listKey,
      networkName,
      txidVersion,
      blockedShield1,
    );
    await BlockedShieldsSyncer.addSignedBlockedShield(
      listKey,
      networkName,
      txidVersion,
      blockedShield2,
    );

    expect(
      BlockedShieldsCache.getCacheSize(listKey, networkName, txidVersion),
    ).to.equal(2);

    const bloomFilter = POINodeBloomFilter.create();
    const bloomFilterSerializedNoData =
      POINodeBloomFilter.serialize(bloomFilter);
    expect(
      BlockedShieldsSyncer.getFilteredBlockedShields(
        txidVersion,
        listKey,
        networkName,
        bloomFilterSerializedNoData,
      ),
    ).to.deep.equal([blockedShield1, blockedShield2]);

    bloomFilter.add(blockedShield1.blindedCommitment);
    const bloomFilterSerializedWithProof1 =
      POINodeBloomFilter.serialize(bloomFilter);
    expect(
      BlockedShieldsSyncer.getFilteredBlockedShields(
        txidVersion,
        listKey,
        networkName,
        bloomFilterSerializedWithProof1,
      ),
    ).to.deep.equal([blockedShield2]);
  }).timeout(10000);

  it('Should inflate blocked shields cache from database', async () => {
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
    const blockedShieldData2 = {
      commitmentHash: '0x1234',
      blindedCommitment: '0x5678',
      blockReason: 'another',
    };
    const blockedShield2: SignedBlockedShield = {
      commitmentHash: blockedShieldData2.commitmentHash,
      blindedCommitment: blockedShieldData2.blindedCommitment,
      blockReason: blockedShieldData2.blockReason,
      signature: await signBlockedShield(
        blockedShieldData2.commitmentHash,
        blockedShieldData2.blindedCommitment,
        blockedShieldData2.blockReason,
      ),
    };

    await BlockedShieldsSyncer.addSignedBlockedShield(
      listKey,
      networkName,
      txidVersion,
      blockedShield1,
    );
    await BlockedShieldsSyncer.addSignedBlockedShield(
      listKey,
      networkName,
      txidVersion,
      blockedShield2,
    );

    expect(
      BlockedShieldsCache.getCacheSize(listKey, networkName, txidVersion),
    ).to.equal(2);

    BlockedShieldsCache.clearCache_FOR_TEST_ONLY();
    expect(
      BlockedShieldsCache.getCacheSize(listKey, networkName, txidVersion),
    ).to.equal(0);

    await BlockedShieldsSyncer.inflateCacheFromDatabase([listKey]);
    expect(
      BlockedShieldsCache.getCacheSize(listKey, networkName, txidVersion),
    ).to.equal(2);
  }).timeout(10000);
});
