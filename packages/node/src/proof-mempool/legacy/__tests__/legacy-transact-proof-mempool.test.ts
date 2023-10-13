import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { LegacyTransactProofMempool } from '../../legacy/legacy-transact-proof-mempool';
import Sinon, { SinonStub } from 'sinon';
import * as WalletModule from '../../../engine/wallet';
import {
  NetworkName,
  TXIDVersion,
  LegacyTransactProofData,
} from '@railgun-community/shared-models';
import { MOCK_LIST_KEYS } from '../../../tests/mocks.test';
import { DatabaseClient } from '../../../database/database-client-init';
import { LegacyTransactProofMempoolCache } from '../../legacy/legacy-transact-proof-mempool-cache';
import { POINodeBloomFilter } from '../../../util/poi-node-bloom-filters';
import { ListProviderPOIEventQueue } from '../../../list-provider/list-provider-poi-event-queue';
import { LegacyTransactProofMempoolDatabase } from '../../../database/databases/legacy-transact-proof-mempool-database';
import { POIMerkletreeManager } from '../../../poi-events/poi-merkletree-manager';
import { POIOrderedEventsDatabase } from '../../../database/databases/poi-ordered-events-database';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;
const listKey = MOCK_LIST_KEYS[0];

let legacyTransactProofMempoolDB: LegacyTransactProofMempoolDatabase;
let orderedEventDB: POIOrderedEventsDatabase;

let tryValidateRailgunTxidOccurredBeforeBlockNumberStub: SinonStub;
let legacyTransactProofMempoolVerifyBlindedCommitmentStub: SinonStub;

describe('legacy-transact-proof-mempool', () => {
  before(async function run() {
    await DatabaseClient.init();
    POIMerkletreeManager.initListMerkletrees([listKey]);
    legacyTransactProofMempoolDB = new LegacyTransactProofMempoolDatabase(
      networkName,
      txidVersion,
    );
    orderedEventDB = new POIOrderedEventsDatabase(networkName, txidVersion);
    tryValidateRailgunTxidOccurredBeforeBlockNumberStub = Sinon.stub(
      WalletModule,
      'tryValidateRailgunTxidOccurredBeforeBlockNumber',
    ).resolves(true);
    legacyTransactProofMempoolVerifyBlindedCommitmentStub = Sinon.stub(
      LegacyTransactProofMempool,
      'verifyBlindedCommitment',
    ).resolves(true);
  });

  beforeEach(async () => {
    await legacyTransactProofMempoolDB.deleteAllItems_DANGEROUS();
    await orderedEventDB.deleteAllItems_DANGEROUS();
    LegacyTransactProofMempoolCache.clearCache_FOR_TEST_ONLY();
  });

  afterEach(async () => {
    await legacyTransactProofMempoolDB.deleteAllItems_DANGEROUS();
    await orderedEventDB.deleteAllItems_DANGEROUS();
    LegacyTransactProofMempoolCache.clearCache_FOR_TEST_ONLY();
  });

  after(() => {
    tryValidateRailgunTxidOccurredBeforeBlockNumberStub.restore();
    legacyTransactProofMempoolVerifyBlindedCommitmentStub.restore();
  });

  it('Should only add valid legacy transact proofs', async () => {
    const legacyTransactProofData: LegacyTransactProofData = {
      txidIndex: '1',
      npk: '0x6789',
      value: '10',
      tokenHash: '0x1234',
      blindedCommitment: '0xabcd',
    };

    ListProviderPOIEventQueue.listKey = listKey;

    const listProviderEventQueueSpy = Sinon.spy(
      ListProviderPOIEventQueue,
      'queueUnsignedPOILegacyTransactEvent',
    );

    await LegacyTransactProofMempool.submitLegacyProof(
      networkName,
      txidVersion,
      legacyTransactProofData,
      [],
    );
    await expect(
      legacyTransactProofMempoolDB.legacyProofExists(
        legacyTransactProofData.blindedCommitment,
      ),
    ).to.eventually.equal(true);

    expect(listProviderEventQueueSpy.calledOnce).to.equal(true);
    listProviderEventQueueSpy.restore();
  }).timeout(100000);

  it('Should add to legacy transact cache and get bloom-filtered transact proofs', async () => {
    const legacyTransactProofData1: LegacyTransactProofData = {
      txidIndex: '1',
      npk: '0x6789',
      value: '10',
      tokenHash: '0x1234',
      blindedCommitment: '0xabcd',
    };
    const legacyTransactProofData2: LegacyTransactProofData = {
      txidIndex: '2',
      npk: '0x7890',
      value: '11',
      tokenHash: '0x1234',
      blindedCommitment: '0x6666',
    };

    await LegacyTransactProofMempool.submitLegacyProof(
      networkName,
      txidVersion,
      legacyTransactProofData1,
      [listKey],
    );
    await LegacyTransactProofMempool.submitLegacyProof(
      networkName,
      txidVersion,
      legacyTransactProofData2,
      [listKey],
    );

    expect(
      LegacyTransactProofMempoolCache.getCacheSize(networkName, txidVersion),
    ).to.equal(2);

    const bloomFilter = POINodeBloomFilter.create();
    const bloomFilterSerializedNoData =
      POINodeBloomFilter.serialize(bloomFilter);
    expect(
      LegacyTransactProofMempool.getFilteredProofs(
        networkName,
        txidVersion,
        bloomFilterSerializedNoData,
      ),
    ).to.deep.equal([legacyTransactProofData1, legacyTransactProofData2]);

    bloomFilter.add(legacyTransactProofData1.blindedCommitment);
    const bloomFilterSerializedWithProof1 =
      POINodeBloomFilter.serialize(bloomFilter);
    expect(
      LegacyTransactProofMempool.getFilteredProofs(
        networkName,
        txidVersion,
        bloomFilterSerializedWithProof1,
      ),
    ).to.deep.equal([legacyTransactProofData2]);
  }).timeout(10000);

  it('Should inflate legacy transact cache from database', async () => {
    const legacyTransactProofData1: LegacyTransactProofData = {
      txidIndex: '1',
      npk: '0x6789',
      value: '10',
      tokenHash: '0x1234',
      blindedCommitment: '0xabcd',
    };
    const legacyTransactProofData2: LegacyTransactProofData = {
      txidIndex: '2',
      npk: '0x7890',
      value: '11',
      tokenHash: '0x1234',
      blindedCommitment: '0x6666',
    };

    await LegacyTransactProofMempool.submitLegacyProof(
      networkName,
      txidVersion,
      legacyTransactProofData1,
      [],
    );
    await LegacyTransactProofMempool.submitLegacyProof(
      networkName,
      txidVersion,
      legacyTransactProofData2,
      [],
    );

    expect(
      LegacyTransactProofMempoolCache.getCacheSize(networkName, txidVersion),
    ).to.equal(2);

    LegacyTransactProofMempoolCache.clearCache_FOR_TEST_ONLY();
    expect(
      LegacyTransactProofMempoolCache.getCacheSize(networkName, txidVersion),
    ).to.equal(0);

    await LegacyTransactProofMempool.inflateCacheFromDatabase();
    expect(
      LegacyTransactProofMempoolCache.getCacheSize(networkName, txidVersion),
    ).to.equal(2);
  }).timeout(10000);
});
