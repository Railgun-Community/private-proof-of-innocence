import {
  NetworkName,
  isDefined,
  MerkleProof,
  POIStatus,
  BlindedCommitmentData,
  BlindedCommitmentType,
  POIsPerListMap,
  TXIDVersion,
  Chain,
  networkForChain,
} from '@railgun-community/shared-models';
import { Config } from '../config/config';
import { POIMerkletree } from './poi-merkletree';
import { SignedPOIEvent } from '../models/poi-types';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { BlockedShieldsPerListDatabase } from '../database/databases/blocked-shields-per-list-database';
import { POIHistoricalMerklerootDatabase } from '../database/databases/poi-historical-merkleroot-database';

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

  static async getTotalEventsAllPOIMerkletrees(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ) {
    const merkletree = POIMerkletreeManager.getMerkletreeForListAndNetwork(
      listKey,
      networkName,
      txidVersion,
    );
    return merkletree.getTotalEventsAllTrees();
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

    const merkleProofs: MerkleProof[] = []
    for (const blindedCommitment of blindedCommitments) {
      const nodeHash = blindedCommitment;
      merkleProofs.push(await merkletree.getMerkleProofFromNodeHash(nodeHash))
    }
    return merkleProofs;
  }

  static async getPOIStatusPerList(
    listKeys: string[],
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitmentDatas: BlindedCommitmentData[],
  ): Promise<POIsPerListMap> {
    const poisPerListMap: POIsPerListMap = {};

    for (const listKey of listKeys) {
      if (!this.listKeys.includes(listKey)) continue;
      for (const blindedCommitmentData of blindedCommitmentDatas) {
         const { blindedCommitment } = blindedCommitmentData;
        poisPerListMap[blindedCommitment] ??= {};
        poisPerListMap[blindedCommitment][listKey] =
          await POIMerkletreeManager.getPOIStatus(
            listKey,
            networkName,
            txidVersion,
            blindedCommitmentData,
          );
      }
    }
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

  static async validateAllPOIMerklerootsExist(
    txidVersion: TXIDVersion,
    networkName: NetworkName,
    listKey: string,
    poiMerkleroots: string[],
  ) {
    const poiMerklerootDb = new POIHistoricalMerklerootDatabase(
      networkName,
      txidVersion,
    );
    const allPOIMerklerootsExist = await poiMerklerootDb.allMerklerootsExist(
      listKey,
      poiMerkleroots,
    );
    return allPOIMerklerootsExist;
  }

  static async validateAllPOIMerklerootsExistWithChain(
    txidVersion: TXIDVersion,
    chain: Chain,
    listKey: string,
    poiMerkleroots: string[],
  ) {
    const network = networkForChain(chain);
    if (!network) {
      throw new Error('Network not found for chain');
    }
    return POIMerkletreeManager.validateAllPOIMerklerootsExist(
      txidVersion,
      network.name,
      listKey,
      poiMerkleroots,
    );
  }
}
