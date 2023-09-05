import { ProofOfInnocenceNode } from './proof-of-innocence-node';
import { LocalListProvider } from './local-list-provider';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  const listProvider = new LocalListProvider();

  const node = new ProofOfInnocenceNode(listProvider);
  await node.start();
})();
