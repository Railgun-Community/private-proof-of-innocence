import { NetworkName, isDefined } from '@railgun-community/shared-models';
import { Config } from '../config/config';
import { POIMerkletree } from './poi-merkletree';
import { MerkleProof } from '../models/proof-types';

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
  ): Promise<MerkleProof[]> {
    const merkletree = this.merkletrees[listKey][networkName];
    if (!isDefined(merkletree)) {
      throw new Error('No merkletree for list/network');
    }

    const merkleProofs: MerkleProof[] = await Promise.all(
      blindedCommitments.map((blindedCommitment) => {
        const nodeHash = blindedCommitment;
        return merkletree.getMerkleProofFromNodeHash(nodeHash);
      }),
    );
    return merkleProofs;
  }
}
