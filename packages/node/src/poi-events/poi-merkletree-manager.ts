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
import {
  POIsPerBlindedCommitmentMap,
  SignedPOIEvent,
} from '../models/poi-types';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { BlockedShieldsPerListDatabase } from '../database/databases/blocked-shields-per-list-database';
import { POIHistoricalMerklerootDatabase } from '../database/databases/poi-historical-merkleroot-database';
import { ListProviderPOIEventQueue } from '../list-provider/list-provider-poi-event-queue';
import { nodeURLForListKey } from '../config/general';
import { POINodeRequest } from '../api/poi-node-request';
import debug from 'debug';

const dbg = debug('poi:merkletree-manager');

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

  static async getHistoricalMerkleroot(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    index: number,
  ): Promise<Optional<string>> {
    const historicalMerklerootDB = new POIHistoricalMerklerootDatabase(
      networkName,
      txidVersion,
    );
    const merklerootDBItem =
      await historicalMerklerootDB.getMerklerootByGlobalLeafIndex(
        listKey,
        index,
      );
    return merklerootDBItem?.rootHash;
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

  static async getPOIMerkletreeLeaves(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    startIndex: number,
    endIndex: number,
  ): Promise<string[]> {
    const merkletree = POIMerkletreeManager.getMerkletreeForListAndNetwork(
      listKey,
      networkName,
      txidVersion,
    );
    return merkletree.getLeaves(startIndex, endIndex);
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
    validatedMerkleroot: Optional<string>,
  ) {
    const merkletree = POIMerkletreeManager.getMerkletreeForListAndNetwork(
      listKey,
      networkName,
      txidVersion,
    );
    await merkletree.insertLeaf(
      signedPOIEvent.index,
      signedPOIEvent.blindedCommitment,
      validatedMerkleroot,
    );
  }

  static async getMerkleProofs(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitments: string[],
  ): Promise<MerkleProof[]> {
    if (ListProviderPOIEventQueue.listKey !== listKey) {
      // Forward request to list provider directly
      const nodeURL = nodeURLForListKey(listKey);
      if (isDefined(nodeURL)) {
        try {
          return await POINodeRequest.getMerkleProofs(
            nodeURL,
            networkName,
            txidVersion,
            listKey,
            blindedCommitments,
          );
        } catch (err) {
          dbg(
            `WARNING: Could not request merkleproofs from list provider. Using node's current DB instead.`,
          );
        }
      }
    }

    return this.getMerkleProofsFromCurrentNode(
      listKey,
      networkName,
      txidVersion,
      blindedCommitments,
    );
  }

  private static async getMerkleProofsFromCurrentNode(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitments: string[],
  ) {
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

        const poiStatusPerBlindedCommitment =
          await this.poiStatusPerBlindedCommitment(
            listKey,
            networkName,
            txidVersion,
            blindedCommitmentDatas,
          );

        Object.entries(poiStatusPerBlindedCommitment).forEach(
          ([blindedCommitment, poiStatus]) => {
            poisPerListMap[blindedCommitment] ??= {};
            poisPerListMap[blindedCommitment][listKey] = poiStatus;
          },
        );
      }),
    );
    return poisPerListMap;
  }

  static async poiStatusPerBlindedCommitment(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitmentDatas: BlindedCommitmentData[],
  ): Promise<POIsPerBlindedCommitmentMap> {
    if (ListProviderPOIEventQueue.listKey !== listKey) {
      // Forward request to list provider directly
      const nodeURL = nodeURLForListKey(listKey);
      if (isDefined(nodeURL)) {
        try {
          return await POINodeRequest.getPOIStatusPerBlindedCommitment(
            nodeURL,
            networkName,
            txidVersion,
            listKey,
            blindedCommitmentDatas,
          );
        } catch (err) {
          dbg(
            `WARNING: Could not get poi status from list provider. Using node's current DB instead.`,
          );
        }
      }
    }

    const poiStatusPerBlindedCommitmentMap: {
      [blindedCommitment: string]: POIStatus;
    } = {};
    await Promise.all(
      blindedCommitmentDatas.map(async blindedCommitmentData => {
        const { blindedCommitment } = blindedCommitmentData;
        poiStatusPerBlindedCommitmentMap[blindedCommitment] =
          await POIMerkletreeManager.getPOIStatus(
            listKey,
            networkName,
            txidVersion,
            blindedCommitmentData,
          );
      }),
    );
    return poiStatusPerBlindedCommitmentMap;
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
      dbg(`POI exists in merkletree for ${blindedCommitment}`);
      return POIStatus.Valid;
    }

    switch (type) {
      case BlindedCommitmentType.Shield: {
        dbg(`Checking if shield is blocked for ${blindedCommitment}`);
        const shieldBlockedDB = new BlockedShieldsPerListDatabase(
          networkName,
          txidVersion,
        );
        const shieldBlocked = await shieldBlockedDB.isShieldBlockedByList(
          listKey,
          blindedCommitment,
        );
        if (shieldBlocked) {
          dbg(`POIStatus.ShieldBlocked for ${blindedCommitment}`);
          return POIStatus.ShieldBlocked;
        }
        break;
      }

      case BlindedCommitmentType.Transact: {
        dbg(`Checking if transact proof exists for ${blindedCommitment}`);
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
          dbg(`Transact POIStatus.ProofSubmitted for ${blindedCommitment}`);
          return POIStatus.ProofSubmitted;
        }
        break;
      }

      case BlindedCommitmentType.Unshield: {
        dbg(`Checking if unshield proof exists for ${blindedCommitment}`);
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
          dbg(`Unshield POIStatus.ProofSubmitted for ${blindedCommitment}`);
          return POIStatus.ProofSubmitted;
        }
        break;
      }
    }

    dbg(`POIStatus.Missing for ${blindedCommitment}`);
    return POIStatus.Missing;
  }

  static async getHistoricalPOIMerklerootsCount(
    txidVersion: TXIDVersion,
    networkName: NetworkName,
    listKey: string,
  ) {
    const poiMerklerootDb = new POIHistoricalMerklerootDatabase(
      networkName,
      txidVersion,
    );
    const total = await poiMerklerootDb.getTotalMerkleroots(listKey);
    return total;
  }

  static async getLatestPOIMerkleroot(
    txidVersion: TXIDVersion,
    networkName: NetworkName,
    listKey: string,
  ): Promise<Optional<string>> {
    const poiMerklerootDb = new POIHistoricalMerklerootDatabase(
      networkName,
      txidVersion,
    );
    const latestMerklerootDbItem =
      await poiMerklerootDb.getLatestMerkleroot(listKey);
    return latestMerklerootDbItem?.rootHash;
  }

  static async validateAllPOIMerklerootsExist(
    txidVersion: TXIDVersion,
    networkName: NetworkName,
    listKey: string,
    poiMerkleroots: string[],
  ): Promise<boolean> {
    if (ListProviderPOIEventQueue.listKey !== listKey) {
      // Forward request to list provider directly
      const nodeURL = nodeURLForListKey(listKey);
      if (isDefined(nodeURL)) {
        try {
          return await POINodeRequest.validatePOIMerkleroots(
            nodeURL,
            networkName,
            txidVersion,
            listKey,
            poiMerkleroots,
          );
        } catch (err) {
          dbg(
            `WARNING: Could not validate merkleroots from list provider. Using node's current DB instead.`,
          );
        }
      }
    }

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
  ): Promise<boolean> {
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
