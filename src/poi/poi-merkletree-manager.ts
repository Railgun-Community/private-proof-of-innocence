import { NetworkName } from '@railgun-community/shared-models';
import { POIMerkleProof } from '../models/api-types';
import { Config } from '../config/config';
import { POIMerkletree } from './poi-merkletree';

export class POIMerkletreeManager {
  private static merkletrees: Record<
    string, // listKey
    Record<NetworkName, POIMerkletree>
  > = {};

  static initListMerkletrees() {
    Config.NETWORK_NAMES.forEach((networkName) => {
      Config.LIST_KEYS.forEach((listKey) => {
        this.merkletrees[listKey][networkName] = new POIMerkletree(
          networkName,
          listKey,
        );
      });
    });
  }

  static async getMerkleProofs(
    listKey: string,
    networkName: NetworkName,
    blindedCommitments: string[],
  ): Promise<POIMerkleProof[]> {
    // TODO-HIGH-PRI
    throw new Error('Unimplemented');
  }
}
