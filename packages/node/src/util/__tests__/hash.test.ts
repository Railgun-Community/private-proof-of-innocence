import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { sha256Hash } from '../hash';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('hash', () => {
  before(() => {});

  it('Should get sha256 hash of data object', async () => {
    const data = { something: 'here' };
    const hash = sha256Hash(data);
    expect(hash).to.equal(
      '0x5019670fc6338b71a1ef5dcb4185d8beb2b64d17803ce50643a8c920b0c19205',
    );
  });
});
