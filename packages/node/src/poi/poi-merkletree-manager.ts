import {
  NetworkName,
  isDefined,
  MerkleProof,
  POIStatus,
  POIStatusListMap,
} from '@railgun-community/shared-models';
import { Config } from '../config/config';
import { POIMerkletree } from './poi-merkletree';
import { SignedPOIEvent } from '../models/poi-types';

export class POIMerkletreeManager {
  private static merkletrees: Record<
    string, // listKey
    Partial<Record<NetworkName, POIMerkletree>>
  > = {};

  static initListMerkletrees(listKeys: string[]) {
    Config.NETWORK_NAMES.forEach((networkName) => {
      listKeys.forEach((listKey) => {
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

  static async getPOIStatusPerList(
    listKeys: string[],
    networkName: NetworkName,
    blindedCommitments: string[],
  ): Promise<POIStatusListMap> {
    const statusListMap: POIStatusListMap = {};
    await Promise.all(
      listKeys.map(async (listKey) => {
        statusListMap[listKey] = await Promise.all(
          blindedCommitments.map((blindedCommitment) =>
            POIMerkletreeManager.getPOIStatus(
              listKey,
              networkName,
              blindedCommitment,
            ),
          ),
        );
      }),
    );
    return statusListMap;
  }

  private static async getPOIStatus(
    listKey: string,
    networkName: NetworkName,
    blindedCommitment: string,
  ): Promise<POIStatus> {
    const merkletree = POIMerkletreeManager.getMerkletreeForListAndNetwork(
      listKey,
      networkName,
    );

    const hasValidPOI = await merkletree.nodeHashExists(blindedCommitment);
    if (hasValidPOI) {
      return POIStatus.Valid;
    }

    // TODO: Check if shield exists.
    // POIStatus.ShieldPending

    // TODO: How do we check if transact proof exists?
    // POIStatus.TransactProofSubmitted

    // TODO: Blocked DB
    // const isBlocked = await blockedDB.shieldBlockedByList(listKey);
    // if (isBlocked) {
    //   return POIStatus.Blocked;
    // }

    return POIStatus.Missing;
  }
}
