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
    ListProviderPOIEventQueue.clearEventQueue_TestOnly(
      networkName,
      txidVersion,
    );
  });

  afterEach(async () => {
    await poiHistoricalMerklerootDB.deleteAllItems_DANGEROUS();
    await orderedEventDB.deleteAllItems_DANGEROUS();
    await poiMerkletreeDB.deleteAllItems_DANGEROUS();
  });

  after(() => {
    checkIfRailgunTxidExistsStub.restore();
  });

  it('Should add valid single-commitment-proofs', async () => {
    const singleCommitmentProofsData: SingleCommitmentProofsData = {
      railgunTxid:
        '0fefd169291c1deec2affa8dcbfbee4a4bbeddfc3b5723c031665ba631725c62',
      utxoTreeIn: 0,
      utxoTreeOut: 0,
      utxoPositionOut: 1,
      commitment:
        '0x2c5acad8f41f95a2795997353f6cdb0838493cd5604f8ddc1859a468233e15ac',
      npk: '0x0630ebf7bb25061ed25456a453912fd502a5b8ebc19ca3f8b88cb51ef6b88c92',
      pois: {
        test_list: {
          '136f24c883d58d7130d8e001a043bad3b2b09a36104bec5b6a0f8181b7d0fa70': {
            snarkProof: {
              pi_a: [
                '5380762281835890066100090423863705522896972209892318692303327183855508202767',
                '11036679349320452419967824441721309024857468320780759951614866246507617986379',
              ],
              pi_b: [
                [
                  '5115840209701577903925325063762772924357454881596996800947316604059087792757',
                  '16512788805950483671906566767892308778067849690985609542392540226010090835490',
                ],
                [
                  '14211819371472883670521096940957426318269436505511811018946379122303800209684',
                  '3010912222885073021392049091933573960610932519969201999874020107525206868234',
                ],
              ],
              pi_c: [
                '12876359361927135091199956730466477505146955933153249817303688966791342815821',
                '1711500457819302634083345214883352639387259771625484512325980604438024281129',
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
      0, // index
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
        '0x009496b785d48f34983bd248bbf0c0b12bba749689c017d9d016493b419f0571', // blinded commitment
      ),
    ).to.equal(true);
  }).timeout(10000);
});
