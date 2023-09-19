import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  NetworkName,
  delay,
  TransactProofData,
  POIStatus,
  BlindedCommitmentType,
} from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database/database-client-init';
import { ListProviderPOIEventQueue } from '../list-provider-poi-event-queue';
import { POIMerkletreeManager } from '../../poi/poi-merkletree-manager';
import { TransactProofPerListMempoolDatabase } from '../../database/databases/transact-proof-per-list-mempool-database';
import { POIOrderedEventsDatabase } from '../../database/databases/poi-ordered-events-database';
import { POIMerkletreeDatabase } from '../../database/databases/poi-merkletree-database';
import { MOCK_LIST_KEYS, MOCK_SNARK_PROOF } from '../../tests/mocks.test';
import { Config } from '../../config/config';
import { POIEventShield, POIEventType } from '../../models/poi-types';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.Ethereum;

let orderedEventsDB: POIOrderedEventsDatabase;
let transactProofMempoolDB: TransactProofPerListMempoolDatabase;
let poiMerkletreeDB: POIMerkletreeDatabase;

const listKey = MOCK_LIST_KEYS[0];

describe('list-provider-poi-event-queue', () => {
  before(async () => {
    await DatabaseClient.init();

    ListProviderPOIEventQueue.init(listKey);
    POIMerkletreeManager.initListMerkletrees(MOCK_LIST_KEYS);

    orderedEventsDB = new POIOrderedEventsDatabase(networkName);
    transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
      networkName,
    );
    poiMerkletreeDB = new POIMerkletreeDatabase(networkName);
  });

  afterEach(async () => {
    await orderedEventsDB.deleteAllItems_DANGEROUS();
    await transactProofMempoolDB.deleteAllItems_DANGEROUS();
    await poiMerkletreeDB.deleteAllItems_DANGEROUS();
  });

  beforeEach(async () => {
    await orderedEventsDB.deleteAllItems_DANGEROUS();
    await transactProofMempoolDB.deleteAllItems_DANGEROUS();
    await poiMerkletreeDB.deleteAllItems_DANGEROUS();
  });

  it('Should add shield and transact events to queue', async () => {
    const poiEventShield: POIEventShield = {
      type: POIEventType.Shield,
      commitmentHash: '0x1234',
      blindedCommitment: '0x5678',
    };

    const transactProofData: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      blindedCommitmentOutputs: ['0x1111', '0x2222'],
      poiMerkleroots: ['0x3333', '0x4444'],
      txidMerkleroot: '0x1234567890',
      txidMerklerootIndex: 55,
    };
    await transactProofMempoolDB.insertTransactProof(
      listKey,
      transactProofData,
    );
    expect(
      await transactProofMempoolDB.proofExists(listKey, '0x1111'),
    ).to.equal(true);

    // Queue proofs serially - they should process in order
    ListProviderPOIEventQueue.queueUnsignedPOIShieldEvent(
      networkName,
      poiEventShield,
    );
    ListProviderPOIEventQueue.queueUnsignedPOITransactEvent(
      networkName,
      transactProofData,
    );

    // Wait for queue to process
    await delay(1000);

    // Expect all events to be added to merkletree
    const poiStatusPerList = await POIMerkletreeManager.getPOIStatusPerList(
      Config.LIST_KEYS,
      networkName,
      [
        { blindedCommitment: '0x5678', type: BlindedCommitmentType.Shield },
        { blindedCommitment: '0x1111', type: BlindedCommitmentType.Shield },
        { blindedCommitment: '0x2222', type: BlindedCommitmentType.Shield },
        { blindedCommitment: '0x3333', type: BlindedCommitmentType.Shield },
      ],
    );
    expect(poiStatusPerList).to.deep.equal({
      [MOCK_LIST_KEYS[0]]: [
        POIStatus.Valid,
        POIStatus.Valid,
        POIStatus.Valid,
        POIStatus.Missing,
      ],
      [MOCK_LIST_KEYS[1]]: [
        POIStatus.Missing,
        POIStatus.Missing,
        POIStatus.Missing,
        POIStatus.Missing,
      ],
    });

    // Expect transact proof to be removed
    expect(
      await transactProofMempoolDB.proofExists(listKey, '0x1111'),
    ).to.equal(false);
  }).timeout(200000);
});
