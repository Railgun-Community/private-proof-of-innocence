/// <reference types="../types/index" />
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ProofOfInnocenceNode } from '../proof-of-innocence-node';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('proof-of-innocence-node', () => {
  after(async () => {
    await ProofOfInnocenceNode.stop();
  });

  it('Should start up the node', async () => {
    await ProofOfInnocenceNode.start();
  }).timeout(10000);
});
