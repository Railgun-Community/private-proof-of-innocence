import LevelDOWN from 'leveldown';
import {
  stopRailgunEngine,
  ArtifactStore,
  loadProvider,
  setLoggers,
  startRailgunEngineForPOINode,
} from '@railgun-community/wallet';
import fs from 'fs';
import {
  FallbackProviderJsonConfig,
  NetworkName,
} from '@railgun-community/shared-models';
import { Config } from '../config/config';
import debug from 'debug';

const dbgLog = debug('poi:engine:log');
const dbgError = debug('poi:engine:error');

let engineStarted = false;

const fileExists = (path: string): Promise<boolean> => {
  return new Promise(resolve => {
    fs.promises
      .access(path)
      .then(() => resolve(true))
      .catch(() => resolve(false));
  });
};

const testArtifactStore = new ArtifactStore(
  fs.promises.readFile,
  async (dir, path, data) => {
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(path, data);
  },
  fileExists,
);

export const startEngine = () => {
  if (engineStarted) {
    return;
  }
  const levelDB = new LevelDOWN(Config.ENGINE_DB_DIR);

  const shouldDebug = true;
  setLoggers(dbgLog, dbgError);

  startRailgunEngineForPOINode(levelDB, shouldDebug, testArtifactStore);

  engineStarted = true;
};

export const stopEngine = async () => {
  if (!engineStarted) {
    return;
  }
  await stopRailgunEngine();
  engineStarted = false;
};

/**
 * Note: This call is async, but you may call it synchronously
 * so it will run the slow scan in the background.
 */
export const loadEngineProvider = async (
  networkName: NetworkName,
  providerJsonConfig: FallbackProviderJsonConfig,
) => {
  if (!engineStarted) {
    // No RailgunEngine instance (might be in unit test).
    throw new Error('No engine instance.');
  }
  await loadProvider(providerJsonConfig, networkName);
};
