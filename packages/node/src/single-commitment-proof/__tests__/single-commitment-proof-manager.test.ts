import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SingleCommitmentProofManager } from '../single-commitment-proof-manager';
import {
  NetworkName,
  SingleCommitmentProofsData,
  TXIDVersion,
  delay,
} from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database/database-client-init';
import { POIHistoricalMerklerootDatabase } from '../../database/databases/poi-historical-merkleroot-database';
import { ListProviderPOIEventQueue } from '../../list-provider/list-provider-poi-event-queue';
import { POIOrderedEventsDatabase } from '../../database/databases/poi-ordered-events-database';
import { startEngine } from '../../engine/engine-init';
import Sinon, { SinonStub } from 'sinon';
import { RailgunTxidMerkletreeManager } from '../../railgun-txids/railgun-txid-merkletree-manager';
import { POIMerkletreeManager } from '../../poi-events/poi-merkletree-manager';
import { POIMerkletreeDatabase } from '../../database/databases/poi-merkletree-database';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;
const listKey = 'test_list';

let poiHistoricalMerklerootDB: POIHistoricalMerklerootDatabase;
let orderedEventDB: POIOrderedEventsDatabase;
let poiMerkletreeDB: POIMerkletreeDatabase;

let checkIfRailgunTxidExistsStub: SinonStub;

describe('single-commitment-proof-manager', () => {
  before(async function run() {
    await DatabaseClient.init();
    startEngine();
    ListProviderPOIEventQueue.init(listKey);
    POIMerkletreeManager.initListMerkletrees([listKey]);
    poiHistoricalMerklerootDB = new POIHistoricalMerklerootDatabase(
      networkName,
      txidVersion,
    );
    orderedEventDB = new POIOrderedEventsDatabase(networkName, txidVersion);
    poiMerkletreeDB = new POIMerkletreeDatabase(networkName, txidVersion);
    checkIfRailgunTxidExistsStub = Sinon.stub(
      RailgunTxidMerkletreeManager,
      'checkIfRailgunTxidExists',
    ).resolves(true);
  });

  beforeEach(async () => {
    await poiHistoricalMerklerootDB.deleteAllItems_DANGEROUS();
    await orderedEventDB.deleteAllItems_DANGEROUS();
    await poiMerkletreeDB.deleteAllItems_DANGEROUS();
  });

  afterEach(async () => {
    await poiHistoricalMerklerootDB.deleteAllItems_DANGEROUS();
    await orderedEventDB.deleteAllItems_DANGEROUS();
    await poiMerkletreeDB.deleteAllItems_DANGEROUS();
  });

  after(() => {
    checkIfRailgunTxidExistsStub.restore();
  });

  it.only('Should add valid single-commitment-proofs', async () => {
    const singleCommitmentProofsData: SingleCommitmentProofsData = {
      railgunTxid:
        '0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62',
      utxoTreeIn: 0,
      utxoTreeOut: 0,
      utxoPositionOut: 69,
      commitment:
        '0x2c5acad8f41f95a2795997353f6cdb0838493cd5604f8ddc1859a468233e15ac',
      npk: '0x0630ebf7bb25061ed25456a453912fd502a5b8ebc19ca3f8b88cb51ef6b88c92',
      pois: {
        test_list: {
          '136f24c883d58d7130d8e001a043bad3b2b09a36104bec5b6a0f8181b7d0fa70': {
            snarkProof: {
              pi_a: [
                '13766471856281251472923302905099603168301598594631438526482227084351434874784',
                '8588729525737659890182759996444901624839043933579336012761314740925805937052',
              ],
              pi_b: [
                [
                  '14369045691397547776662456281960288655359320266442203106166271127565009565977',
                  '13979602192554711032664475121727723415005805236727028063872064436784678703054',
                ],
                [
                  '19941723190973813766411664236004793025252825360816561816851087470547847175501',
                  '17786622999411477509388993850683907602108444106094119333080295444943292227976',
                ],
              ],
              pi_c: [
                '640379350533687394488172632727298795692314074384434085471944446397998938790',
                '20177179856562770201382212249372199931536044097005309916738846107336280050881',
              ],
            },
            txidMerkleroot:
              '171280a4deabf34cc6d73713225ece6565516313f4475a07177d0736e2b4eaa4',
            poiMerkleroots: [
              '284d03b4f4e545a9bf5259162f0d5103c1598c98217b84ec51589610d94f7071',
            ],
            blindedCommitmentsOut: [
              '0x1441c994c1336075c8fc3687235e583fb5fa37e561184585bac31e3c029a46eb',
              '0x19f596cb35c783ce81498026696fae8f84de0937f68354ef29a08bf8c01e3f38',
            ],
            railgunTxidIfHasUnshield:
              '0x0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62',
          },
        },
      },
    };

    await poiHistoricalMerklerootDB.insertMerkleroot(
      listKey,
      '284d03b4f4e545a9bf5259162f0d5103c1598c98217b84ec51589610d94f7071',
    );

    await SingleCommitmentProofManager.submitProof(
      networkName,
      txidVersion,
      singleCommitmentProofsData,
    );

    // Delay until event added from queue (risky)
    await delay(500);

    expect(
      await orderedEventDB.eventExists(
        listKey,
        '0x0b95484bf02c80c14bac4696bbd73ab2f29ec142d47c674f62cad4c042a91b0c', // blinded commitment
      ),
    ).to.equal(true);
  }).timeout(10000);
});
