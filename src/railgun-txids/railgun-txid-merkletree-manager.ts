import { NetworkName, isDefined } from '@railgun-community/shared-models';
import {
  fullResetRailgunTxidMerkletrees,
  resetRailgunTxidsAfterTxidIndex,
  validateRailgunTxidMerkleroot,
  getLatestRailgunTxidData,
  getRailgunTxidMerkleroot,
} from '@railgun-community/wallet';
import {
  RailgunTxidStatus,
  ValidatedRailgunTxidStatus,
} from '../models/api-types';
import { RailgunTxidMerkletreeStatusDatabase } from '../database/databases/railgun-txid-merkletree-status-database';
import { POINodeRequest } from '../api/poi-node-request';
import debug from 'debug';

const dbg = debug('poi:railgun-txid-merkletree');

const TREE_MAX_ITEMS = 65536;

export class RailgunTxidMerkletreeManager {
  static async checkIfMerklerootExists(
    networkName: NetworkName,
    tree: number,
    index: number,
    merkleroot: string,
  ): Promise<boolean> {
    return validateRailgunTxidMerkleroot(networkName, tree, index, merkleroot);
  }

  static async checkIfMerklerootExistsByTxidIndex(
    networkName: NetworkName,
    txidIndex: number,
    merkleroot: string,
  ): Promise<boolean> {
    const { tree, index } = this.getTreeAndIndexFromTxidIndex(txidIndex);
    return validateRailgunTxidMerkleroot(networkName, tree, index, merkleroot);
  }

  static async fullResetRailgunTxidMerkletrees(networkName: NetworkName) {
    return fullResetRailgunTxidMerkletrees(networkName);
  }

  static async resetRailgunTxidsAfterTxidIndex(
    networkName: NetworkName,
    txidIndex: number,
  ) {
    return resetRailgunTxidsAfterTxidIndex(networkName, txidIndex);
  }

  static async getValidatedRailgunTxidStatus(
    networkName: NetworkName,
  ): Promise<ValidatedRailgunTxidStatus> {
    const db = new RailgunTxidMerkletreeStatusDatabase(networkName);
    const status = await db.getStatus();

    return {
      validatedTxidIndex: status?.validatedTxidIndex,
      validatedMerkleroot: status?.validatedTxidMerkleroot,
    };
  }

  static async getRailgunTxidStatus(
    networkName: NetworkName,
  ): Promise<RailgunTxidStatus> {
    const { txidIndex: currentTxidIndex, merkleroot: currentMerkleroot } =
      await getLatestRailgunTxidData(networkName);
    const { validatedTxidIndex, validatedMerkleroot } =
      await RailgunTxidMerkletreeManager.getValidatedRailgunTxidStatus(
        networkName,
      );
    return {
      currentTxidIndex,
      currentMerkleroot,
      validatedTxidIndex,
      validatedMerkleroot,
    };
  }

  private static getTreeAndIndexFromTxidIndex(txidIndex: number): {
    tree: number;
    index: number;
  } {
    return {
      tree: Math.floor(txidIndex / TREE_MAX_ITEMS),
      index: txidIndex % TREE_MAX_ITEMS,
    };
  }

  static async updateValidatedRailgunTxidStatus(
    nodeURL: string,
    networkName: NetworkName,
    txidStatusOtherNode: RailgunTxidStatus,
  ): Promise<void> {
    const {
      validatedTxidIndex: validatedTxidIndexA,
      currentTxidIndex: currentTxidIndexA,
    } = await this.getRailgunTxidStatus(networkName);
    const { currentTxidIndex: currentTxidIndexB } = txidStatusOtherNode;

    if (!isDefined(currentTxidIndexA)) {
      return;
    }
    if (!isDefined(currentTxidIndexB)) {
      return;
    }

    // Update validated txid if the other node has a current value > this node's validated value.
    const shouldUpdateValidatedTxid =
      !isDefined(validatedTxidIndexA) ||
      currentTxidIndexB > validatedTxidIndexA;
    if (!shouldUpdateValidatedTxid) {
      return;
    }

    // Validate the smaller of the current indices on the two nodes
    const txidIndexToValidate = Math.min(currentTxidIndexA, currentTxidIndexB);

    const { tree, index } =
      this.getTreeAndIndexFromTxidIndex(txidIndexToValidate);

    const historicalMerkleroot = await getRailgunTxidMerkleroot(
      networkName,
      tree,
      index,
    );
    if (!isDefined(historicalMerkleroot)) {
      dbg('Historical merkleroot does not exist');
      return;
    }

    const isValid = await POINodeRequest.validateRailgunTxidMerkleroot(
      nodeURL,
      networkName,
      tree,
      index,
      historicalMerkleroot,
    );
    if (isValid) {
      // Valid. Update validated txid.
      const db = new RailgunTxidMerkletreeStatusDatabase(networkName);
      await db.saveValidatedTxidStatus(
        txidIndexToValidate,
        historicalMerkleroot,
      );
      return;
    }

    // Invalid. Clear the merkletree after validatedTxidIndexA, and re-sync.
    const clearFromTxidIndex = validatedTxidIndexA ?? -1;
    await this.resetRailgunTxidsAfterTxidIndex(networkName, clearFromTxidIndex);
  }
}
