import {
  NetworkName,
  isDefined,
  MerkleProof,
  POIStatus,
  BlindedCommitmentData,
  BlindedCommitmentType,
  POIsPerListMap,
  TXIDVersion,
} from '@railgun-community/shared-models';
import { Config } from '../config/config';
import { POIMerkletree } from './poi-merkletree';
import { SignedPOIEvent } from '../models/poi-types';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { BlockedShieldsPerListDatabase } from '../database/databases/blocked-shields-per-list-database';

export class POIMerkletreeManager {
  private static merkletrees: Record<
    string, // listKey
    Partial<Record<NetworkName, Partial<Record<TXIDVersion, POIMerkletree>>>>
  > = {};

  private static listKeys: string[] = [];

  static initListMerkletrees(listKeys: string[]) {
    this.listKeys = listKeys;
    Config.NETWORK_NAMES.forEach(networkName => {
      Config.TXID_VERSIONS.forEach(txidVersion => {
        listKeys.forEach(listKey => {
          this.merkletrees[listKey] ??= {};
          this.merkletrees[listKey][networkName] ??= {};
          (
            this.merkletrees[listKey][networkName] as Partial<
              Record<TXIDVersion, POIMerkletree>
            >
          )[txidVersion] = new POIMerkletree(networkName, txidVersion, listKey);
        });
      });
    });
  }

  static clearAllMerkletrees_TestOnly() {
    this.merkletrees = {};
  }

  private static getMerkletreeForListAndNetwork(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): POIMerkletree {
    const merkletree = this.merkletrees[listKey]?.[networkName]?.[txidVersion];
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
    txidVersion: TXIDVersion,
    signedPOIEvent: SignedPOIEvent,
  ) {
    const merkletree = POIMerkletreeManager.getMerkletreeForListAndNetwork(
      listKey,
      networkName,
      txidVersion,
    );
    await merkletree.insertLeaf(
      signedPOIEvent.index,
      signedPOIEvent.blindedCommitment,
    );
  }

  static async getMerkleProofs(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitments: string[],
  ): Promise<MerkleProof[]> {
    const merkletree = POIMerkletreeManager.getMerkletreeForListAndNetwork(
      listKey,
      networkName,
      txidVersion,
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
    listKeys: string[],
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitmentDatas: BlindedCommitmentData[],
  ): Promise<POIsPerListMap> {
    const poisPerListMap: POIsPerListMap = {};

    await Promise.all(
      listKeys.map(async listKey => {
        if (!this.listKeys.includes(listKey)) {
          return;
        }
        await Promise.all(
          blindedCommitmentDatas.map(async blindedCommitmentData => {
            const { blindedCommitment } = blindedCommitmentData;
            poisPerListMap[blindedCommitment] ??= {};
            poisPerListMap[blindedCommitment][listKey] =
              await POIMerkletreeManager.getPOIStatus(
                listKey,
                networkName,
                txidVersion,
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
    txidVersion: TXIDVersion,
    blindedCommitmentData: BlindedCommitmentData,
  ): Promise<POIStatus> {
    const merkletree = POIMerkletreeManager.getMerkletreeForListAndNetwork(
      listKey,
      networkName,
      txidVersion,
    );

    const { blindedCommitment, type } = blindedCommitmentData;

    const hasValidPOI = await merkletree.nodeHashExists(blindedCommitment);
    if (hasValidPOI) {
      return POIStatus.Valid;
    }

    switch (type) {
      case BlindedCommitmentType.Shield: {
        const shieldBlockedDB = new BlockedShieldsPerListDatabase(
          networkName,
          txidVersion,
        );
        const shieldBlocked = await shieldBlockedDB.isShieldBlockedByList(
          listKey,
          blindedCommitment,
        );
        if (shieldBlocked) {
          return POIStatus.ShieldBlocked;
        }
        break;
      }

      case BlindedCommitmentType.Transact: {
        const transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
          networkName,
          txidVersion,
        );
        const transactProofExists =
          await transactProofMempoolDB.getProofContainingBlindedCommitmentOut(
            listKey,
            blindedCommitment,
          );
        if (isDefined(transactProofExists)) {
          return POIStatus.ProofSubmitted;
        }
        break;
      }

      case BlindedCommitmentType.Unshield: {
        const transactProofMempoolDB = new TransactProofPerListMempoolDatabase(
          networkName,
          txidVersion,
        );
        const unshieldProofExists =
          await transactProofMempoolDB.getProofContainingRailgunTxidIfHasUnshield(
            listKey,
            blindedCommitment, // railgunTxid for unshields
          );
        if (isDefined(unshieldProofExists)) {
          return POIStatus.ProofSubmitted;
        }
        break;
      }
    }

    return POIStatus.Missing;
  }
}
