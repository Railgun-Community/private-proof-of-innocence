import { ProofOfInnocenceNode } from './proof-of-innocence-node';
import { LocalListProvider } from './local-list-provider';
import { Config } from './config/config';

import 'dotenv/config';
import { getListPublicKey } from './util/ed25519';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  Config.MONGODB_URL = 'mongodb://localhost:27017';

  const listKey = await getListPublicKey();
  const listProvider = new LocalListProvider(listKey);

  const host = process.env.HOST ?? '0.0.0.0';
  const port = process.env.PORT ?? '3010';
  const connectedNodeURLs: string[] = (
    process.env.CONNECTED_NODE_URLS ?? ''
  ).split(',');
  const listKeys: string[] = (process.env.LIST_KEYS ?? '').split(',');

  Config.LIST_KEYS = listKeys;

  const node = new ProofOfInnocenceNode(
    host,
    port,
    connectedNodeURLs,
    listProvider,
  );
  await node.start();
})();
