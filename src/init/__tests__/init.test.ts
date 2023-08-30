import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import * as engineInitModule from '../../engine/engine-init';
import * as activeProvidersModule from '../../rpc-providers/active-network-providers';
import { init } from '../init';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('init', () => {
  after(async () => {});

  it('Should run init scripts', async () => {
    const stubInitEngine = sinon
      .stub(engineInitModule, 'startEngine')
      .returns();
    const stubInitNetworkProviders = sinon
      .stub(activeProvidersModule, 'initNetworkProviders')
      .resolves();

    await init();

    expect(stubInitEngine.calledOnce).to.be.true;
    expect(stubInitNetworkProviders.calledOnce).to.be.true;

    stubInitEngine.restore();
    stubInitNetworkProviders.restore();
  });
}).timeout(10000);
