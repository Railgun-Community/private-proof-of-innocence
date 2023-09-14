import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import * as activeProvidersModule from '../../rpc-providers/active-network-providers';
import { initModules } from '../init';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('init', () => {
  before(async () => {});

  it('Should run init scripts', async () => {
    const stubInitNetworkProviders = sinon
      .stub(activeProvidersModule, 'initNetworkProviders')
      .resolves();

    await initModules();

    expect(stubInitNetworkProviders.calledOnce).to.be.true;

    stubInitNetworkProviders.restore();
  });
}).timeout(10000);
