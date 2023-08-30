/// <reference types="../types/index" />
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { ProofOfInnocenceNode } from '../proof-of-innocence-node';
import { ListProvider } from '../list-provider/list-provider';

chai.use(chaiAsPromised);
// const { expect } = chai;

let node: ProofOfInnocenceNode;

describe('proof-of-innocence-node', () => {
  before(() => {
    node = new ProofOfInnocenceNode();
  });

  after(async () => {
    await node.stop();
  });

  it('Should start up the node', async () => {
    const listProviders: ListProvider[] = [];
    await node.start(listProviders);
  }).timeout(10000);
});
