import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import * as activeProvidersModule from '../../rpc-providers/active-network-providers';
import { initModules } from '../init';
import { MOCK_LIST_KEYS } from '../../tests/mocks.test';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('init', () => {
  before(async () => {});

  it('Should run init scripts', async () => {
    const stubInitNetworkProviders = sinon
      .stub(activeProvidersModule, 'initNetworkProviders')
      .resolves();

    await initModules(MOCK_LIST_KEYS);

    expect(stubInitNetworkProviders.calledOnce).to.be.true;

    stubInitNetworkProviders.restore();
  });
}).timeout(10000);
