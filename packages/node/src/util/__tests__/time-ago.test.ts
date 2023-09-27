import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { daysAgo, hoursAgo } from '../time-ago';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('time-ago', () => {
  it('Should validate days/hours/min ago', async () => {
    expect(daysAgo(1)).to.be.lessThan(Date.now());
    expect(daysAgo(1)).to.be.lessThanOrEqual(hoursAgo(24));
    expect(daysAgo(1)).to.be.greaterThan(1695764141924);
  });
});
