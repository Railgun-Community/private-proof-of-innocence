import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  NetworkName,
  TransactProofData,
  NodeStatusAllNetworks,
  ShieldQueueStatus,
  TXIDVersion,
  LegacyTransactProofData,
  POIEventType,
} from '@railgun-community/shared-models';
import * as WalletModule from '../../engine/wallet';
import { DatabaseClient } from '../../database/database-client-init';
import { RoundRobinSyncer } from '../round-robin-syncer';
import { POIMerkletreeDatabase } from '../../database/databases/poi-merkletree-database';
import { POIHistoricalMerklerootDatabase } from '../../database/databases/poi-historical-merkleroot-database';
import { MOCK_SNARK_PROOF } from '../../tests/mocks.test';
import { POIOrderedEventsDatabase } from '../../database/databases/poi-ordered-events-database';
import sinon, { SinonStub } from 'sinon';
import { POINodeRequest } from '../../api/poi-node-request';
import { SignedBlockedShield, SignedPOIEvent } from '../../models/poi-types';
import { ListProviderPOIEventQueue } from '../../list-provider/list-provider-poi-event-queue';
import { getListPublicKey, signBlockedShield } from '../../util/ed25519';
import { POIMerkletreeManager } from '../../poi-events/poi-merkletree-manager';
import { TransactProofPerListMempoolDatabase } from '../../database/databases/transact-proof-per-list-mempool-database';
import * as SnarkProofVerifyModule from '../../util/snark-proof-verify';
import { BlockedShieldsPerListDatabase } from '../../database/databases/blocked-shields-per-list-database';
import { LegacyTransactProofMempoolDatabase } from '../../database/databases/legacy-transact-proof-mempool-database';
import { LegacyTransactProofMempool } from '../../proof-mempool/legacy/legacy-transact-proof-mempool';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let merkletreeDB: POIMerkletreeDatabase;
let merklerootDB: POIHistoricalMerklerootDatabase;
let orderedEventsDB: POIOrderedEventsDatabase;
let transactProofMempoolDB: TransactProofPerListMempoolDatabase;
let legacyTransactProofMempoolDB: LegacyTransactProofMempoolDatabase;
let blockedShieldsDB: BlockedShieldsPerListDatabase;

let roundRobinSyncer: RoundRobinSyncer;

let listKey: string;

let verifyTransactProofStub: SinonStub;
let tryValidateRailgunTxidOccurredBeforeBlockNumberStub: SinonStub;
let legacyTransactProofMempoolVerifyBlindedCommitmentStub: SinonStub;

const nodeURL = 'mock-node-url';

const getNodeStatus = (): NodeStatusAllNetworks => ({
  listKeys: [listKey],
  forNetwork: {
    [networkName]: {
      txidStatus: {
        currentMerkleroot: '80',
        currentTxidIndex: 80,
        validatedMerkleroot: '50',
        validatedTxidIndex: 50,
      },
      listStatuses: {
        [listKey]: {
          poiEventLengths: {
            [POIEventType.Shield]: 2,
            [POIEventType.Transact]: 0,
            [POIEventType.Unshield]: 0,
            [POIEventType.LegacyTransact]: 0,
          },
          pendingTransactProofs: 2,
          blockedShields: 2,
          historicalMerklerootsLength: 2,
          latestHistoricalMerkleroot: '0x1234',
        },
      },
      shieldQueueStatus: {} as ShieldQueueStatus,
      legacyTransactProofs: 1,
    },
  },
});

describe('round-robin-syncer', () => {
  before(async () => {
    listKey = await getListPublicKey();

    await DatabaseClient.init();

    merkletreeDB = new POIMerkletreeDatabase(networkName, txidVersion);
    merklerootDB = new POIHistoricalMerklerootDatabase(
      networkName,
      txidVersion,
    );
    orderedEventsDB = new POIOrderedEventsDatabase(networkName, txidVersion);
    transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
      networkName,
      txidVersion,
    );
    legacyTransactProofMempoolDB = new LegacyTransactProofMempoolDatabase(
      networkName,
      txidVersion,
    );
    blockedShieldsDB = new BlockedShieldsPerListDatabase(
      networkName,
      txidVersion,
    );

    POIMerkletreeManager.initListMerkletrees([listKey]);

    roundRobinSyncer = new RoundRobinSyncer(
      [{ name: 'test', nodeURL, listKey }],
      [listKey],
    );

    verifyTransactProofStub = sinon
      .stub(SnarkProofVerifyModule, 'verifyTransactProof')
      .resolves(true);
    tryValidateRailgunTxidOccurredBeforeBlockNumberStub = sinon
      .stub(WalletModule, 'tryValidateRailgunTxidOccurredBeforeBlockNumber')
      .resolves(true);
    legacyTransactProofMempoolVerifyBlindedCommitmentStub = sinon
      .stub(LegacyTransactProofMempool, 'verifyBlindedCommitment')
      .resolves(true);
  });

  after(() => {
    verifyTransactProofStub.restore();
    tryValidateRailgunTxidOccurredBeforeBlockNumberStub.restore();
    legacyTransactProofMempoolVerifyBlindedCommitmentStub.restore();
  });

  beforeEach(async () => {
    await merkletreeDB.deleteAllItems_DANGEROUS();
    await merklerootDB.deleteAllItems_DANGEROUS();
    await orderedEventsDB.deleteAllItems_DANGEROUS();
    await transactProofMempoolDB.deleteAllItems_DANGEROUS();
    await blockedShieldsDB.deleteAllItems_DANGEROUS();
  });
  afterEach(async () => {
    await merkletreeDB.deleteAllItems_DANGEROUS();
    await merklerootDB.deleteAllItems_DANGEROUS();
    await orderedEventsDB.deleteAllItems_DANGEROUS();
    await transactProofMempoolDB.deleteAllItems_DANGEROUS();
    await blockedShieldsDB.deleteAllItems_DANGEROUS();
  });

  it('Should update POI event list', async () => {
    const signedEvent0: SignedPOIEvent =
      await ListProviderPOIEventQueue.createSignedPOIEvent(
        0, // index
        {
          type: POIEventType.Shield,
          blindedCommitment: '0x1111',
          commitmentHash: '',
        },
      );
    const signedEvent1: SignedPOIEvent =
      await ListProviderPOIEventQueue.createSignedPOIEvent(
        1, // index
        {
          type: POIEventType.Transact,
          blindedCommitment: '0x2222',
        },
      );
    const signedEvent2: SignedPOIEvent =
      await ListProviderPOIEventQueue.createSignedPOIEvent(
        2, // index
        {
          type: POIEventType.Shield,
          blindedCommitment: '0x4444',
          commitmentHash: '',
        },
      );

    const getPOIListEventRangeStub = sinon
      .stub(POINodeRequest, 'getPOIListEventRange')
      .resolves([
        {
          signedPOIEvent: signedEvent0,
          validatedMerkleroot:
            '026ce23444c0f0b880caee8779f8a567ad938495d22f2e5b3d5fbeb27b8780df',
        },
        {
          signedPOIEvent: signedEvent1,
          validatedMerkleroot:
            '2064d1357da08a2ff6fc5bb88fb4bb4e972a9b9f9e5ae013cfcd58e1ee91c630',
        },
        {
          signedPOIEvent: signedEvent2,
          validatedMerkleroot:
            '1babab2e24fe7c987a33112ba1976cd886b57563b9984387340312c66c70943b',
        },
      ]);

    await roundRobinSyncer.updatePOIEventListAllNetworks(
      nodeURL,
      getNodeStatus(),
    );

    // Make sure all events sync
    expect(
      await orderedEventsDB.getCount(listKey, POIEventType.Shield),
    ).to.equal(2);
    expect(
      await orderedEventsDB.getCount(listKey, POIEventType.Transact),
    ).to.equal(1);

    getPOIListEventRangeStub.restore();
  });

  it('Should update transact proof mempools', async () => {
    const transactProofData1: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x1111', '0x2222'],
      txidMerklerootIndex: 58,
      txidMerkleroot: '0x1234567890',
      blindedCommitmentsOut: ['0x3333', '0x4444'],
      railgunTxidIfHasUnshield: '0x00',
    };
    const transactProofData2: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x9999', '0x8888'],
      txidMerklerootIndex: 59,
      txidMerkleroot: '0x0987654321',
      blindedCommitmentsOut: ['0x3333', '0x4444'],
      railgunTxidIfHasUnshield: '0x7777',
    };

    const getFilteredTransactProofsStub = sinon
      .stub(POINodeRequest, 'getFilteredTransactProofs')
      .resolves([transactProofData1, transactProofData2]);

    await roundRobinSyncer.updateTransactProofMempoolsAllNetworks(
      nodeURL,
      getNodeStatus(),
    );

    // Make sure all transact proofs sync
    expect(
      await transactProofMempoolDB.proofExists(
        listKey,
        transactProofData1.blindedCommitmentsOut,
        transactProofData1.railgunTxidIfHasUnshield,
      ),
    ).to.equal(true);

    // Proof 2 should only exist when including the unshield txid
    expect(
      await transactProofMempoolDB.proofExists(
        listKey,
        transactProofData2.blindedCommitmentsOut,
        '',
      ),
    ).to.equal(false);
    expect(
      await transactProofMempoolDB.proofExists(
        listKey,
        [],
        transactProofData2.railgunTxidIfHasUnshield,
      ),
    ).to.equal(false);
    expect(
      await transactProofMempoolDB.proofExists(
        listKey,
        transactProofData2.blindedCommitmentsOut,
        transactProofData2.railgunTxidIfHasUnshield,
      ),
    ).to.equal(true);

    getFilteredTransactProofsStub.restore();
  }).timeout(20000);

  it('Should update legacy transact proof mempools', async () => {
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

    const getFilteredTransactProofsStub = sinon
      .stub(POINodeRequest, 'getFilteredLegacyTransactProofs')
      .resolves([legacyTransactProofData1, legacyTransactProofData2]);

    await roundRobinSyncer.updateLegacyTransactProofMempoolsAllNetworks(
      nodeURL,
      getNodeStatus(),
    );

    // Make sure all transact proofs sync
    expect(
      await legacyTransactProofMempoolDB.legacyProofExists(
        legacyTransactProofData1.blindedCommitment,
      ),
    ).to.equal(true);
    expect(
      await legacyTransactProofMempoolDB.legacyProofExists(
        legacyTransactProofData2.blindedCommitment,
      ),
    ).to.equal(true);

    getFilteredTransactProofsStub.restore();
  });

  it('Should update blocked shields', async () => {
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

    const getFilteredBlockedShieldsStub = sinon
      .stub(POINodeRequest, 'getFilteredBlockedShields')
      .resolves([blockedShield1, blockedShield2]);

    await roundRobinSyncer.updateBlockedShieldsAllNetworks(
      nodeURL,
      getNodeStatus(),
    );

    // Make sure all blocked shields sync
    expect(
      await blockedShieldsDB.isShieldBlockedByList(
        listKey,
        blockedShield1.blindedCommitment,
      ),
    ).to.equal(true);
    expect(
      await blockedShieldsDB.isShieldBlockedByList(
        listKey,
        blockedShield2.blindedCommitment,
      ),
    ).to.equal(true);

    getFilteredBlockedShieldsStub.restore();
  });
});
