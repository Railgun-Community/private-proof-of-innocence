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

  const envConnectedNodesString = process.env
    .CONNECTED_NODE_URLS as Optional<string>;
  const connectedNodeURLs: string[] = envConnectedNodesString?.split(',') ?? [];

  const envListKeysString = process.env.LIST_KEYS as Optional<string>;
  const listKeys: string[] = envListKeysString?.split(',') ?? [];
  Config.LIST_KEYS = listKeys;

  const node = new ProofOfInnocenceNode(
    host,
    port,
    connectedNodeURLs,
    listProvider,
  );
  await node.start();
})();
