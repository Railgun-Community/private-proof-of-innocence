import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  NetworkName,
  TransactProofData,
  NodeStatusAllNetworks,
  ShieldQueueStatus,
} from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database/database-client-init';
import { RoundRobinSyncer } from '../round-robin-syncer';
import { POIMerkletreeDatabase } from '../../database/databases/poi-merkletree-database';
import { POIHistoricalMerklerootDatabase } from '../../database/databases/poi-historical-merkleroot-database';
import { MOCK_SNARK_PROOF } from '../../tests/mocks.test';
import { POIOrderedEventsDatabase } from '../../database/databases/poi-ordered-events-database';
import sinon, { SinonStub } from 'sinon';
import { POINodeRequest } from '../../api/poi-node-request';
import {
  POIEventType,
  SignedBlockedShield,
  SignedPOIEvent,
} from '../../models/poi-types';
import { ListProviderPOIEventQueue } from '../../list-provider/list-provider-poi-event-queue';
import { getListPublicKey, signBlockedShield } from '../../util/ed25519';
import { POIMerkletreeManager } from '../../poi-events/poi-merkletree-manager';
import { TransactProofPerListMempoolDatabase } from '../../database/databases/transact-proof-per-list-mempool-database';
import * as SnarkProofVerifyModule from '../../util/snark-proof-verify';
import { BlockedShieldsPerListDatabase } from '../../database/databases/blocked-shields-per-list-database';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let merkletreeDB: POIMerkletreeDatabase;
let merklerootDB: POIHistoricalMerklerootDatabase;
let orderedEventsDB: POIOrderedEventsDatabase;
let transactProofMempoolDB: TransactProofPerListMempoolDatabase;
let blockedShieldsDB: BlockedShieldsPerListDatabase;

let roundRobinSyncer: RoundRobinSyncer;

let listKey: string;

let verifyTransactProofStub: SinonStub;

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
          poiEvents: 2,
          pendingTransactProofs: 2,
          blockedShields: 2,
        },
      },
      shieldQueueStatus: {} as ShieldQueueStatus,
    },
  },
});

describe('round-robin-syncer', () => {
  before(async () => {
    listKey = await getListPublicKey();

    await DatabaseClient.init();

    merkletreeDB = new POIMerkletreeDatabase(networkName);
    merklerootDB = new POIHistoricalMerklerootDatabase(networkName);
    orderedEventsDB = new POIOrderedEventsDatabase(networkName);
    transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
      networkName,
    );
    blockedShieldsDB = new BlockedShieldsPerListDatabase(networkName);

    POIMerkletreeManager.initListMerkletrees([listKey]);

    roundRobinSyncer = new RoundRobinSyncer([nodeURL], [listKey]);

    verifyTransactProofStub = sinon
      .stub(SnarkProofVerifyModule, 'verifyTransactProof')
      .resolves(true);
  });

  after(() => {
    verifyTransactProofStub.restore();
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
    const signedEvent1: SignedPOIEvent =
      await ListProviderPOIEventQueue.createSignedPOIEvent(
        0, // index
        0, // blindedCommitmentStartingIndex
        {
          type: POIEventType.Shield,
          blindedCommitment: '0x1111',
          commitmentHash: '',
        },
      );
    const signedEvent2: SignedPOIEvent =
      await ListProviderPOIEventQueue.createSignedPOIEvent(
        1, // index
        1, // blindedCommitmentStartingIndex
        {
          type: POIEventType.Transact,
          blindedCommitments: ['0x2222', '0x3333'],
          proof: MOCK_SNARK_PROOF,
        },
      );
    const signedEvent3: SignedPOIEvent =
      await ListProviderPOIEventQueue.createSignedPOIEvent(
        2, // index
        3, // blindedCommitmentStartingIndex
        {
          type: POIEventType.Shield,
          blindedCommitment: '0x4444',
          commitmentHash: '',
        },
      );

    const getPOIListEventRangeStub = sinon
      .stub(POINodeRequest, 'getPOIListEventRange')
      .resolves([signedEvent1, signedEvent2, signedEvent3]);

    await roundRobinSyncer.updatePOIEventListAllNetworks(
      nodeURL,
      getNodeStatus(),
    );

    // Make sure all events sync
    expect(await orderedEventsDB.getCount(listKey)).to.equal(3);

    getPOIListEventRangeStub.restore();
  });

  it('Should update transact proof mempools', async () => {
    const transactProofData1: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x1111', '0x2222'],
      txidMerklerootIndex: 58,
      txidMerkleroot: '0x1234567890',
      blindedCommitmentOutputs: ['0x3333', '0x4444'],
    };
    const transactProofData2: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      poiMerkleroots: ['0x9999', '0x8888'],
      txidMerklerootIndex: 59,
      txidMerkleroot: '0x0987654321',
      blindedCommitmentOutputs: ['0x7777', '0x6666'],
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
        transactProofData1.blindedCommitmentOutputs[0],
      ),
    ).to.equal(true);
    expect(
      await transactProofMempoolDB.proofExists(
        listKey,
        transactProofData2.blindedCommitmentOutputs[0],
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
