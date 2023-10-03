import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { NodeConfig } from '../models/general-types';

export class Config {
  static NODE_CONFIGS: NodeConfig[] = [];

  static MONGODB_URL = process.env.MONGODB_URL;

  static NETWORK_NAMES: NetworkName[] = [NetworkName.EthereumGoerli];

  static TXID_VERSIONS: TXIDVersion[] = Object.values(TXIDVersion);

  static ENGINE_DB_DIR = 'engine.db';
}
