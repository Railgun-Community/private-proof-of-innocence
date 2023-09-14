import { NetworkName, isDefined } from '@railgun-community/shared-models';
import { Config } from '../config/config';
import { POIMerkletree } from './poi-merkletree';
import { MerkleProof } from '../models/proof-types';
import { POIExistenceListMap } from '../models/api-types';
import { QueryLimits } from '../config/query-limits';
import { SignedPOIEvent } from '../models/poi-types';

export class POIMerkletreeManager {
  private static merkletrees: Record<
    string, // listKey
    Partial<Record<NetworkName, POIMerkletree>>
  > = {};

  static initListMerkletrees() {
    Config.NETWORK_NAMES.forEach((networkName) => {
      Config.LIST_KEYS.forEach((listKey) => {
        this.merkletrees[listKey] ??= {};
        this.merkletrees[listKey][networkName] = new POIMerkletree(
          networkName,
          listKey,
        );
      });
    });
  }

  private static getMerkletreeForListAndNetwork(
    listKey: string,
    networkName: NetworkName,
  ) {
    const merkletree = this.merkletrees[listKey]?.[networkName];
    if (!isDefined(merkletree)) {
      throw new Error('No merkletree for list/network');
    }
    return merkletree;
  }

  static async addPOIEvent(
    listKey: string,
    networkName: NetworkName,
    signedPOIEvent: SignedPOIEvent,
  ) {
    const merkletree = POIMerkletreeManager.getMerkletreeForListAndNetwork(
      listKey,
      networkName,
    );
    const startIndex = signedPOIEvent.blindedCommitmentStartingIndex;
    for (let i = 0; i < signedPOIEvent.blindedCommitments.length; i += 1) {
      const blindedCommitment = signedPOIEvent.blindedCommitments[i];
      await merkletree.insertLeaf(startIndex + i, blindedCommitment);
    }
  }

  static async getMerkleProofs(
    listKey: string,
    networkName: NetworkName,
    blindedCommitments: string[],
  ): Promise<MerkleProof[]> {
    const merkletree = POIMerkletreeManager.getMerkletreeForListAndNetwork(
      listKey,
      networkName,
    );

    const merkleProofs: MerkleProof[] = await Promise.all(
      blindedCommitments.map((blindedCommitment) => {
        const nodeHash = blindedCommitment;
        return merkletree.getMerkleProofFromNodeHash(nodeHash);
      }),
    );
    return merkleProofs;
  }

  static async getPOIExistencePerList(
    listKeys: string[],
    networkName: NetworkName,
    blindedCommitments: string[],
  ): Promise<POIExistenceListMap> {
    if (
      QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS >
      blindedCommitments.length
    ) {
      throw new Error(
        `Too many blinded commitments: max ${QueryLimits.GET_POI_EXISTENCE_MAX_BLINDED_COMMITMENTS}`,
      );
    }

    const existenceListMap: POIExistenceListMap = {};
    await Promise.all(
      listKeys.map(async (listKey) => {
        const merkletree = POIMerkletreeManager.getMerkletreeForListAndNetwork(
          listKey,
          networkName,
        );
        existenceListMap[listKey] = await Promise.all(
          blindedCommitments.map((blindedCommitment) => {
            const nodeHash = blindedCommitment;
            return merkletree.nodeHashExists(nodeHash);
          }),
        );
      }),
    );
    return existenceListMap;
  }
}
