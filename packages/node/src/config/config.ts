import { NetworkName } from '@railgun-community/shared-models';
import { NodeConfig } from '../models/general-types';

export class Config {
  static NODE_CONFIGS: NodeConfig[] = [];

  static MONGODB_URL = process.env.MONGODB_URL;

  static NETWORK_NAMES: NetworkName[] = [
    NetworkName.Ethereum,
    NetworkName.EthereumGoerli,
  ];

  static ENGINE_DB_DIR = 'engine.db';
}
