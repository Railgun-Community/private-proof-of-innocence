import { NetworkName } from '@railgun-community/shared-models';

export class Config {
  static CONNECTED_NODES: string[] = [];

  static LIST_KEYS: string[] = [];

  static MONGODB_URL = process.env.MONGODB_URL;

  static NETWORK_NAMES: NetworkName[] = [
    NetworkName.Ethereum,
    NetworkName.EthereumGoerli,
  ];

  static ENGINE_DB_DIR = 'engine.db';
}
