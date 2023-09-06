import { NetworkName } from '@railgun-community/shared-models';
import { POIMerkleProof } from '../models/api-types';

export class POIMerkletreeManager {
  static async getMerkleProofs(
    listKey: string,
    networkName: NetworkName,
    blindedCommitments: string[],
  ): Promise<POIMerkleProof[]> {
    // TODO-HIGH-PRI
    throw new Error('Unimplemented');
  }
}
