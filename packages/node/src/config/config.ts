import {
  NETWORK_CONFIG,
  NetworkName,
  TXIDVersion,
  isDefined,
} from '@railgun-community/shared-models';
import { NodeConfig } from '../models/general-types';

export class Config {
  static NODE_CONFIGS: NodeConfig[] = [];

  static MONGODB_URL = process.env.MONGODB_URL;

  static NETWORK_NAMES: NetworkName[] = Object.values(NetworkName).filter(
    networkName => {
      return isDefined(NETWORK_CONFIG[networkName].poi);
    },
  );

  static TXID_VERSIONS: TXIDVersion[] = Object.values(TXIDVersion);

  static ENGINE_DB_DIR = 'engine.db';
}
