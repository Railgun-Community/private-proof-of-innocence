import { ProofOfInnocenceNode } from './proof-of-innocence-node';
import { LocalListProvider } from './local-list-provider';
import { Config } from './config/config';

import 'dotenv/config';
import { getListPublicKey } from './util/ed25519';
import { NodeConfig } from './models/general-types';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  Config.MONGODB_URL = 'mongodb://localhost:27017';

  const isListProvider = process.env.LIST_PROVIDER === '1';
  const listKey = await getListPublicKey();
  const listProvider = isListProvider
    ? new LocalListProvider(listKey)
    : undefined;

  const host = process.env.HOST ?? '0.0.0.0';
  const port = process.env.PORT ?? '3010';

  // TODO: Pull the node configs from a file?
  const envNodeConfigsString = process.env.NODE_CONFIGS ?? '[]';
  const nodeConfigs: NodeConfig[] = JSON.parse(envNodeConfigsString);

  Config.NODE_CONFIGS = nodeConfigs;

  const node = new ProofOfInnocenceNode(host, port, nodeConfigs, listProvider);
  await node.start();
})();
