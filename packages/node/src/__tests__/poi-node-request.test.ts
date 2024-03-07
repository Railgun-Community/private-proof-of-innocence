import { expect } from 'chai';
import { POINodeRequest } from '../api/poi-node-request';
import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import sinon from 'sinon';
import axios from 'axios';

describe('POINodeRequest', () => {
  let axiosPostStub: sinon.SinonStub;

  beforeEach(() => {
    axiosPostStub = sinon.stub(axios, 'post');
  });

  afterEach(() => {
    axiosPostStub.restore();
  });

  it('Should validateRailgunTxidMerkleroot', async () => {
    const nodeURL = 'http://localhost:8080';
    const networkName = NetworkName.Ethereum;
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
    const tree = 0;
    const index = 0;
    const merkleroot = '';

    // Stub the axios post request
    axiosPostStub.resolves({ data: { id: 0, result: true } });

    const result = await POINodeRequest.validateRailgunTxidMerkleroot(
      nodeURL,
      networkName,
      txidVersion,
      tree,
      index,
      merkleroot,
    );

    expect(result).to.be.true;
  });

  it('Should getNodeStatusAllNetworks', async () => {
    const nodeURL = '';

    // Stub the axios get request
    axiosPostStub.resolves({
      data: { id: 0, result: { listKeys: [], forNetwork: {} } },
    });

    const result = await POINodeRequest.getNodeStatusAllNetworks(nodeURL);

    expect(result).to.deep.equal({ listKeys: [], forNetwork: {} });
  });

  it('Should getPOIListEventRange', async () => {
    const nodeURL = '';
    const networkName = NetworkName.Ethereum;
    const txidVersion = TXIDVersion.V2_PoseidonMerkle;
    const listKey = '';
    const startIndex = 0;
    const endIndex = 0;

    // Stub the axios get request
    axiosPostStub.resolves({ data: { id: 0, result: [] } });

    const result = await POINodeRequest.getPOIListEventRange(
      nodeURL,
      networkName,
      txidVersion,
      listKey,
      startIndex,
      endIndex,
    );

    expect(result).to.deep.equal([]);
  });
});
