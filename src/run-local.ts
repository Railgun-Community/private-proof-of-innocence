import { ProofOfInnocenceNode } from './proof-of-innocence-node';
import { LocalListProvider } from './local-list-provider';
import { Config } from './config/config';

import 'dotenv/config';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  Config.MONGODB_URL = 'mongodb://localhost:27017';

  const listProvider = new LocalListProvider();

  const node = new ProofOfInnocenceNode(listProvider);
  await node.start();
})();
