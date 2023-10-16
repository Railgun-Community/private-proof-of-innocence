import { ProofOfInnocenceNode } from './proof-of-innocence-node';
import { LocalListProvider } from './local-list-provider';
import { Config } from './config/config';
import 'dotenv/config';
import { getListPublicKey } from './util/ed25519';
import { NodeConfig } from './models/general-types';
import { isListProvider } from './config/general';
import debug from 'debug';

const dbg = debug('poi:main');

process.on('unhandledRejection', (err: Error | string) => {
  dbg('unhandledRejection');
  dbg(err);
});
process.on('uncaughtException', (err: Error | string) => {
  dbg('uncaughtException');
  dbg(err);
});

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  // List providers use a local mongo instance, while aggregators use AWS DocDB.
  Config.MONGODB_URL = isListProvider()
    ? 'mongodb://localhost:27017'
    : `mongodb://${process.env.AWS_DB_USERNAME}:${process.env.AWS_DB_PASSWORD}@poi-db.cluster-ctf3upan4qjq.us-east-1.docdb.amazonaws.com:27017/?tls=true&tlsCAFile=global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false`;

  // Set env "LIST_PROVIDER=1" and "pkey=0xXXXX" to load a list provider.
  const listProvider = isListProvider()
    ? new LocalListProvider(await getListPublicKey())
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
