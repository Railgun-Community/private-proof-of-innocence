import { ProofOfInnocenceNode } from './proof-of-innocence-node';
import { TESTListProvider } from './test-list-provider.test';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const listProvider = new TESTListProvider('test-list-provider');

  const node = new ProofOfInnocenceNode(listProvider);
  await node.start();
})();
