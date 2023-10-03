import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { DatabaseClient } from '../../database/database-client-init';
import { RailgunTxidMerkletreeManager } from '../railgun-txid-merkletree-manager';
import Sinon, { SinonSpy, SinonStub } from 'sinon';
import { startEngine } from '../../engine/engine-init';
import { initNetworkProviders } from '../../rpc-providers/active-network-providers';
import { POINodeRequest } from '../../api/poi-node-request';
import { RailgunTxidMerkletreeStatusDatabase } from '../../database/databases/railgun-txid-merkletree-status-database';

chai.use(chaiAsPromised);
const { expect } = chai;

const networkName = NetworkName.EthereumGoerli;
const txidVersion = TXIDVersion.V2_PoseidonMerkle;

let txidMerkletreeStatusDB: RailgunTxidMerkletreeStatusDatabase;

let getRailgunTxidStatusStub: SinonStub;
let getHistoricalTxidMerklerootStub: SinonStub;
let validateRailgunTxidMerklerootStub: SinonStub;
let resetRailgunTxidsAfterTxidIndexStub: SinonSpy;

const nodeURL = 'node-url';

describe('railgun-txid-merkletree-manager', () => {
  before(async function run() {
    this.timeout(30000);

    await DatabaseClient.init();

    startEngine();
    await initNetworkProviders([networkName]);

    txidMerkletreeStatusDB = new RailgunTxidMerkletreeStatusDatabase(
      networkName,
      txidVersion,
    );

    getRailgunTxidStatusStub = Sinon.stub(
      RailgunTxidMerkletreeManager,
      'getRailgunTxidStatus',
    ).resolves({
      currentMerkleroot: '80',
      currentTxidIndex: 80,
      validatedMerkleroot: '50',
      validatedTxidIndex: 50,
    });

    getHistoricalTxidMerklerootStub = Sinon.stub(
      RailgunTxidMerkletreeManager,
      'getHistoricalTxidMerkleroot',
    ).callsFake(async (_networkName, _txidVersion, _tree, index) => {
      if (index === 60) {
        return '60';
      }
      return undefined;
    });

    validateRailgunTxidMerklerootStub = Sinon.stub(
      POINodeRequest,
      'validateRailgunTxidMerkleroot',
    );

    resetRailgunTxidsAfterTxidIndexStub = Sinon.stub(
      RailgunTxidMerkletreeManager,
      'resetRailgunTxidsAfterTxidIndex',
    ).resolves();
  });

  beforeEach(async () => {
    await txidMerkletreeStatusDB.deleteAllItems_DANGEROUS();
  });

  after(() => {
    getRailgunTxidStatusStub.restore();
    getHistoricalTxidMerklerootStub.restore();
    validateRailgunTxidMerklerootStub.restore();
    resetRailgunTxidsAfterTxidIndexStub.restore();
  });

  it('Should update RAILGUN Txid status when appropriate', async () => {
    // Undefined validatedMerkleroot and validatedTxidIndex
    await expect(
      RailgunTxidMerkletreeManager.updateValidatedRailgunTxidStatus(
        nodeURL,
        networkName,
        txidVersion,
        {
          currentMerkleroot: undefined,
          currentTxidIndex: undefined,
          validatedMerkleroot: undefined,
          validatedTxidIndex: undefined,
        },
      ),
    ).to.eventually.be.rejectedWith('Requires other node current txid index');

    // Other node current index === validated index
    await expect(
      RailgunTxidMerkletreeManager.updateValidatedRailgunTxidStatus(
        nodeURL,
        networkName,
        txidVersion,
        {
          currentMerkleroot: '50',
          currentTxidIndex: 50,
          validatedMerkleroot: undefined,
          validatedTxidIndex: undefined,
        },
      ),
    ).to.eventually.be.rejectedWith('Historical merkleroot does not exist');

    await expect(
      RailgunTxidMerkletreeManager.updateValidatedRailgunTxidStatus(
        nodeURL,
        networkName,
        txidVersion,
        {
          currentMerkleroot: '61',
          currentTxidIndex: 61,
          validatedMerkleroot: undefined,
          validatedTxidIndex: undefined,
        },
      ),
    ).to.eventually.be.rejectedWith('Historical merkleroot does not exist');

    const statusPre = await txidMerkletreeStatusDB.getStatus();
    expect(statusPre).to.equal(undefined);

    // Valid
    validateRailgunTxidMerklerootStub.resolves(true);
    await RailgunTxidMerkletreeManager.updateValidatedRailgunTxidStatus(
      nodeURL,
      networkName,
      txidVersion,
      {
        currentMerkleroot: '60',
        currentTxidIndex: 60,
        validatedMerkleroot: undefined,
        validatedTxidIndex: undefined,
      },
    );

    const statusPostValidEntry = await txidMerkletreeStatusDB.getStatus();
    expect(statusPostValidEntry).to.deep.equal({
      validatedTxidIndex: 60,
      validatedTxidMerkleroot: '60',
    });

    // Clear DB
    await txidMerkletreeStatusDB.deleteAllItems_DANGEROUS();

    // Invalid
    validateRailgunTxidMerklerootStub.resolves(false);
    await RailgunTxidMerkletreeManager.updateValidatedRailgunTxidStatus(
      nodeURL,
      networkName,
      txidVersion,
      {
        currentMerkleroot: '69',
        currentTxidIndex: 60,
        validatedMerkleroot: undefined,
        validatedTxidIndex: undefined,
      },
    );

    const statusPostInvalidEntry = await txidMerkletreeStatusDB.getStatus();
    expect(statusPostInvalidEntry).to.equal(undefined);

    expect(resetRailgunTxidsAfterTxidIndexStub.calledOnce).to.equal(true);
  }).timeout(10000);
});
