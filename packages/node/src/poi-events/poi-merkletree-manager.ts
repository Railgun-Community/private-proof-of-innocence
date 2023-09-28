import {
  NetworkName,
  isDefined,
  MerkleProof,
  POIStatus,
  BlindedCommitmentData,
  BlindedCommitmentType,
  POIsPerListMap,
} from '@railgun-community/shared-models';
import { Config } from '../config/config';
import { POIMerkletree } from './poi-merkletree';
import { SignedPOIEvent } from '../models/poi-types';
import { ShieldQueueDatabase } from '../database/databases/shield-queue-database';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';

export class POIMerkletreeManager {
  private static merkletrees: Record<
    string, // listKey
    Partial<Record<NetworkName, POIMerkletree>>
  > = {};

  private static listKeys: string[] = [];

  static initListMerkletrees(listKeys: string[]) {
    this.listKeys = listKeys;
    Config.NETWORK_NAMES.forEach(networkName => {
      listKeys.forEach(listKey => {
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
      throw new Error(
        `No merkletree for list ${listKey} and network ${networkName}`,
      );
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
      blindedCommitments.map(blindedCommitment => {
        const nodeHash = blindedCommitment;
        return merkletree.getMerkleProofFromNodeHash(nodeHash);
      }),
    );
    return merkleProofs;
  }

  static async getPOIStatusPerList(
    networkName: NetworkName,
    blindedCommitmentDatas: BlindedCommitmentData[],
  ): Promise<POIsPerListMap> {
    const poisPerListMap: POIsPerListMap = {};
    await Promise.all(
      this.listKeys.map(async listKey => {
        await Promise.all(
          blindedCommitmentDatas.map(async blindedCommitmentData => {
            const { blindedCommitment } = blindedCommitmentData;
            poisPerListMap[blindedCommitment] ??= {};
            poisPerListMap[blindedCommitment][listKey] =
              await POIMerkletreeManager.getPOIStatus(
                listKey,
                networkName,
                blindedCommitmentData,
              );
          }),
        );
      }),
    );
    return poisPerListMap;
  }

  static async getPOIStatus(
    listKey: string,
    networkName: NetworkName,
    blindedCommitmentData: BlindedCommitmentData,
  ): Promise<POIStatus> {
    const merkletree = POIMerkletreeManager.getMerkletreeForListAndNetwork(
      listKey,
      networkName,
    );

    const { blindedCommitment, type } = blindedCommitmentData;

    const hasValidPOI = await merkletree.nodeHashExists(blindedCommitment);
    if (hasValidPOI) {
      return POIStatus.Valid;
    }

    switch (type) {
      case BlindedCommitmentType.Shield: {
        const shieldQueueDB = new ShieldQueueDatabase(networkName);
        const shieldExists =
          await shieldQueueDB.blindedCommitmentExists(blindedCommitment);
        if (shieldExists) {
          return POIStatus.ShieldPending;
        }

        // TODO: ShieldBlocked status with db
        // const shieldBlockedDB = new ShieldBlockedDatabase(networkName);
        // const shieldBlocked = await shieldBlockedDB.isShieldBlockedByList(
        //   listKey,
        //   blindedCommitment,
        // );
        // if (shieldBlocked) {
        //   return POIStatus.ShieldBlocked;
        // }
        break;
      }

      case BlindedCommitmentType.Transact: {
        const transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
          networkName,
        );
        const transactProofExists =
          await transactProofMempoolDB.proofExistsContainingBlindedCommitment(
            listKey,
            blindedCommitment,
          );
        if (transactProofExists) {
          return POIStatus.TransactProofSubmitted;
        }
        break;
      }
    }

    return POIStatus.Missing;
  }
}
