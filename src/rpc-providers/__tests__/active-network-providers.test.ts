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
  after(async () => {
    await stopEngine();
  });

  before(async () => {
    startEngine();
    await initNetworkProviders();
  });

  it('Should init viable fallback providers', async () => {
    const provider = getProviderForNetwork(NetworkName.Ethereum);
    const block = await provider.getBlockNumber();
    expect(block).to.be.greaterThan(14000000);
  }).timeout(20000);
}).timeout(20000);
