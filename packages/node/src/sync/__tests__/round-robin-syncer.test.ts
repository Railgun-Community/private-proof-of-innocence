import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NetworkName } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database/database-client-init';
import { RoundRobinSyncer } from '../round-robin-syncer';
import { POIMerkletreeDatabase } from '../../database/databases/poi-merkletree-database';
import { POIHistoricalMerklerootDatabase } from '../../database/databases/poi-historical-merkleroot-database';
import { MOCK_SNARK_PROOF } from '../../tests/mocks.test';
import { NodeStatusAllNetworks } from '../../models/api-types';
import { POIOrderedEventsDatabase } from '../../database/databases/poi-ordered-events-database';
import sinon, { SinonStub } from 'sinon';
import { POINodeRequest } from '../../api/poi-node-request';
import { SignedPOIEvent } from '../../models/poi-types';
import { ListProviderPOIEventQueue } from '../../list-provider/list-provider-poi-event-queue';
import { getListPublicKey } from '../../util/ed25519';
import { POIMerkletreeManager } from '../../poi/poi-merkletree-manager';
import { ShieldProofData } from '../../models/proof-types';
import { ShieldProofMempoolDatabase } from '../../database/databases/shield-proof-mempool-database';
import { TransactProofPerListMempoolDatabase } from '../../database/databases/transact-proof-per-list-mempool-database';
import * as SnarkProofVerifyModule from '../../proof-mempool/snark-proof-verify';
import Sinon from 'sinon';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let merkletreeDB: POIMerkletreeDatabase;
let merklerootDB: POIHistoricalMerklerootDatabase;
let orderedEventsDB: POIOrderedEventsDatabase;
let shieldProofMempoolDB: ShieldProofMempoolDatabase;
let transactProofMempoolDB: TransactProofPerListMempoolDatabase;

let roundRobinSyncer: RoundRobinSyncer;

let listKey: string;

let snarkVerifyStub: SinonStub;

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
      eventListStatuses: {
        [listKey]: { length: 2 },
      },
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
    shieldProofMempoolDB = new ShieldProofMempoolDatabase(networkName);
    transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
      networkName,
    );

    POIMerkletreeManager.initListMerkletrees([listKey]);

    roundRobinSyncer = new RoundRobinSyncer([nodeURL], [listKey]);

    snarkVerifyStub = Sinon.stub(
      SnarkProofVerifyModule,
      'verifySnarkProof',
    ).resolves(true);
  });

  after(() => {
    snarkVerifyStub.restore();
  });

  beforeEach(async () => {
    await merkletreeDB.deleteAllItems_DANGEROUS();
    await merklerootDB.deleteAllItems_DANGEROUS();
    await orderedEventsDB.deleteAllItems_DANGEROUS();
    await shieldProofMempoolDB.deleteAllItems_DANGEROUS();
    await transactProofMempoolDB.deleteAllItems_DANGEROUS();
  });
  afterEach(async () => {
    await merkletreeDB.deleteAllItems_DANGEROUS();
    await merklerootDB.deleteAllItems_DANGEROUS();
    await orderedEventsDB.deleteAllItems_DANGEROUS();
    await shieldProofMempoolDB.deleteAllItems_DANGEROUS();
    await transactProofMempoolDB.deleteAllItems_DANGEROUS();
  });

  it('Should update POI event list', async () => {
    const signedEvent1: SignedPOIEvent =
      await ListProviderPOIEventQueue.createSignedPOIEvent(
        0, // index
        0, // blindedCommitmentStartingIndex
        ['0x1111'], // blindedCommitments
        MOCK_SNARK_PROOF, // proof
      );
    const signedEvent2: SignedPOIEvent =
      await ListProviderPOIEventQueue.createSignedPOIEvent(
        1, // index
        1, // blindedCommitmentStartingIndex
        ['0x2222', '0x3333'], // blindedCommitments
        MOCK_SNARK_PROOF, // proof
      );
    const signedEvent3: SignedPOIEvent =
      await ListProviderPOIEventQueue.createSignedPOIEvent(
        2, // index
        3, // blindedCommitmentStartingIndex
        ['0x4444'], // blindedCommitments
        MOCK_SNARK_PROOF, // proof
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

  it('Should update shield proof mempools', async () => {
    const shieldProofData1: ShieldProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      commitmentHash: '0x1234',
      blindedCommitment: '0x5678',
    };
    const shieldProofData2: ShieldProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      commitmentHash: '0x8888',
      blindedCommitment: '0x9999',
    };

    const getFilteredShieldProofsStub = sinon
      .stub(POINodeRequest, 'getFilteredShieldProofs')
      .resolves([shieldProofData1, shieldProofData2]);

    await roundRobinSyncer.updateShieldProofMempoolsAllNetworks(
      nodeURL,
      getNodeStatus(),
    );

    // Make sure all shields sync
    expect(
      await shieldProofMempoolDB.proofExists(shieldProofData1.commitmentHash),
    ).to.equal(true);
    expect(
      await shieldProofMempoolDB.proofExistsForBlindedCommitment(
        shieldProofData2.blindedCommitment,
      ),
    ).to.equal(true);

    getFilteredShieldProofsStub.restore();
  });
});
