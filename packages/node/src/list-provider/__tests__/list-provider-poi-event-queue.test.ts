import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  NetworkName,
  TransactProofData,
  POIStatus,
  BlindedCommitmentType,
  poll,
  TXIDVersion,
  POIEventType,
} from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database/database-client-init';
import { ListProviderPOIEventQueue } from '../list-provider-poi-event-queue';
import { POIMerkletreeManager } from '../../poi-events/poi-merkletree-manager';
import { TransactProofPerListMempoolDatabase } from '../../database/databases/transact-proof-per-list-mempool-database';
import { POIOrderedEventsDatabase } from '../../database/databases/poi-ordered-events-database';
import { POIMerkletreeDatabase } from '../../database/databases/poi-merkletree-database';
import { MOCK_LIST_KEYS, MOCK_SNARK_PROOF } from '../../tests/mocks.test';
import { POIEventShield } from '../../models/poi-types';
import { ShieldQueueDatabase } from '../../database/databases/shield-queue-database';
import { TransactProofMempoolCache } from '../../proof-mempool/transact-proof-mempool-cache';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let orderedEventsDB: POIOrderedEventsDatabase;
let transactProofMempoolDB: TransactProofPerListMempoolDatabase;
let poiMerkletreeDB: POIMerkletreeDatabase;
let shieldQueueDB: ShieldQueueDatabase;

const listKey = MOCK_LIST_KEYS[0];

describe('list-provider-poi-event-queue', () => {
  before(async () => {
    await DatabaseClient.init();

    ListProviderPOIEventQueue.init(listKey);
    POIMerkletreeManager.initListMerkletrees(MOCK_LIST_KEYS);

    orderedEventsDB = new POIOrderedEventsDatabase(networkName, txidVersion);
    transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
      networkName,
      txidVersion,
    );
    poiMerkletreeDB = new POIMerkletreeDatabase(networkName, txidVersion);
    shieldQueueDB = new ShieldQueueDatabase(networkName, txidVersion);
  });

  afterEach(async () => {
    await orderedEventsDB.deleteAllItems_DANGEROUS();
    await transactProofMempoolDB.deleteAllItems_DANGEROUS();
    TransactProofMempoolCache.clearCache_FOR_TEST_ONLY();
    await poiMerkletreeDB.deleteAllItems_DANGEROUS();
    await shieldQueueDB.deleteAllItems_DANGEROUS();
  });

  beforeEach(async () => {
    await orderedEventsDB.deleteAllItems_DANGEROUS();
    await transactProofMempoolDB.deleteAllItems_DANGEROUS();
    TransactProofMempoolCache.clearCache_FOR_TEST_ONLY();
    await poiMerkletreeDB.deleteAllItems_DANGEROUS();
    await shieldQueueDB.deleteAllItems_DANGEROUS();
    ListProviderPOIEventQueue.clearMinimumNextAddIndex_TestOnly();
  });

  after(() => {
    POIMerkletreeManager.clearAllMerkletrees_TestOnly();
  });

  it('Should add shield and transact events to queue', async () => {
    const poiEventShield: POIEventShield = {
      type: POIEventType.Shield,
      commitmentHash: '0x1234',
      blindedCommitment: '0x5678',
    };

    const transactProofData: TransactProofData = {
      snarkProof: MOCK_SNARK_PROOF,
      blindedCommitmentsOut: ['0x1111', '0x2222'],
      poiMerkleroots: ['0x3333', '0x4444'],
      txidMerkleroot: '0x1234567890',
      txidMerklerootIndex: 55,
      railgunTxidIfHasUnshield: '0x00',
    };
    await transactProofMempoolDB.insertTransactProof(
      listKey,
      transactProofData,
    );
    expect(
      await transactProofMempoolDB.proofExists(
        listKey,
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
      ),
    ).to.equal(true);

    // Queue proofs serially - they should process in order
    ListProviderPOIEventQueue.queueUnsignedPOIShieldEvent(
      listKey,
      networkName,
      txidVersion,
      poiEventShield,
    );
    ListProviderPOIEventQueue.queueUnsignedPOITransactEvent(
      listKey,
      networkName,
      txidVersion,
      transactProofData,
    );

    // Wait until queue is empty
    const pollQueueLength = await poll(
      async () =>
        ListProviderPOIEventQueue.getPOIEventQueueLength(
          networkName,
          txidVersion,
        ),
      queueLength => queueLength === 0,
      20,
      5000 / 20, // 5 sec.
    );
    if (pollQueueLength !== 0) {
      throw new Error(
        `Queue should be empty after processing - timed out. Still have events: ${ListProviderPOIEventQueue.getPOIEventQueueLength(
          networkName,
          txidVersion,
        )}`,
      );
    }

    // Expect all events to be added to merkletree
    const poiStatusPerList = await POIMerkletreeManager.getPOIStatusPerList(
      MOCK_LIST_KEYS,
      networkName,
      txidVersion,
      [
        { blindedCommitment: '0x5678', type: BlindedCommitmentType.Shield },
        { blindedCommitment: '0x1111', type: BlindedCommitmentType.Shield },
        { blindedCommitment: '0x2222', type: BlindedCommitmentType.Shield },
        { blindedCommitment: '0x3333', type: BlindedCommitmentType.Shield },
      ],
    );
    expect(poiStatusPerList).to.deep.equal({
      '0x5678': {
        [MOCK_LIST_KEYS[0]]: POIStatus.Valid,
        [MOCK_LIST_KEYS[1]]: POIStatus.Missing,
      },
      '0x1111': {
        [MOCK_LIST_KEYS[0]]: POIStatus.Valid,
        [MOCK_LIST_KEYS[1]]: POIStatus.Missing,
      },
      '0x2222': {
        [MOCK_LIST_KEYS[0]]: POIStatus.Valid,
        [MOCK_LIST_KEYS[1]]: POIStatus.Missing,
      },
      '0x3333': {
        [MOCK_LIST_KEYS[0]]: POIStatus.Missing,
        [MOCK_LIST_KEYS[1]]: POIStatus.Missing,
      },
    });

    // Expect transact proof to be removed
    expect(
      await transactProofMempoolDB.proofExists(
        listKey,
        transactProofData.blindedCommitmentsOut,
        transactProofData.railgunTxidIfHasUnshield,
      ),
    ).to.equal(false);
  }).timeout(40000);
});
