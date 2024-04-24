import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {
  getProviderForNetwork,
  initNetworkProviders,
} from '../active-network-providers';
import { startEngine, stopEngine } from '../../engine/engine-init';
import { NetworkName } from '@railgun-community/shared-models';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('active-network-providers', () => {
  before(async function run() {
    this.timeout(30000);
    await startEngine();
    await initNetworkProviders([NetworkName.EthereumGoerli_DEPRECATED]);
  });

  after(async () => {
    await stopEngine();
  });

  it('Should init viable fallback providers', async () => {
    const provider = getProviderForNetwork(
      NetworkName.EthereumGoerli_DEPRECATED,
    );
    const block = await provider.getBlockNumber();
    expect(block).to.be.greaterThan(9_000_000);
  });
}).timeout(20000);
