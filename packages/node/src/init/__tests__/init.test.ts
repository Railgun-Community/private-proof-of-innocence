import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { initDatabases, initEngineAndScanTXIDs, initModules } from '../init';
import { MOCK_LIST_KEYS } from '../../tests/mocks.test';

chai.use(chaiAsPromised);
// const { expect } = chai;

describe('init', () => {
  before(async () => {});

  it('Should run init scripts', async () => {
    await initDatabases();
    await initEngineAndScanTXIDs();
    await initModules(MOCK_LIST_KEYS);
  }).timeout(10000);
});
