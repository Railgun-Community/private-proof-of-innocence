import {
  NetworkName,
  isDefined,
  RailgunTxidStatus,
  ValidatedRailgunTxidStatus,
  TXIDVersion,
} from '@railgun-community/shared-models';
import {
  resetRailgunTxidsAfterTxidIndex,
  validateRailgunTxidMerkleroot,
  getLatestRailgunTxidData,
  getRailgunTxidMerkleroot,
  fullResetTXIDMerkletrees,
} from '@railgun-community/wallet';
import { RailgunTxidMerkletreeStatusDatabase } from '../database/databases/railgun-txid-merkletree-status-database';
import { POINodeRequest } from '../api/poi-node-request';
import debug from 'debug';
import { PushSync } from '../sync/push-sync';
import { verifyTxidMerkleroot } from '../util/ed25519';
import { nodeURLForListKey } from '../config/general';

const dbg = debug('poi:railgun-txid-merkletree');

const TREE_MAX_ITEMS = 65536;

export class RailgunTxidMerkletreeManager {
  static async checkIfMerklerootExists(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    tree: number,
    index: number,
    merkleroot: string,
  ): Promise<boolean> {
    return validateRailgunTxidMerkleroot(
      txidVersion,
      networkName,
      tree,
      index,
      merkleroot,
    );
  }

  static async checkIfMerklerootExistsByTxidIndex(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    txidIndex: number,
    merkleroot: string,
  ): Promise<boolean> {
    const { tree, index } = this.getTreeAndIndexFromTxidIndex(txidIndex);
    return validateRailgunTxidMerkleroot(
      txidVersion,
      networkName,
      tree,
      index,
      merkleroot,
    );
  }

  static async fullResetRailgunTxidMerkletrees(networkName: NetworkName) {
    return fullResetTXIDMerkletrees(networkName);
  }

  static async resetRailgunTxidsAfterTxidIndex(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    txidIndex: number,
  ) {
    return resetRailgunTxidsAfterTxidIndex(txidVersion, networkName, txidIndex);
  }

  static async getValidatedRailgunTxidStatus(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Promise<ValidatedRailgunTxidStatus> {
    const db = new RailgunTxidMerkletreeStatusDatabase(
      networkName,
      txidVersion,
    );
    const status = await db.getStatus();

    return {
      validatedTxidIndex: status?.validatedTxidIndex,
      validatedMerkleroot: status?.validatedTxidMerkleroot,
    };
  }

  static async getRailgunTxidStatus(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
  ): Promise<RailgunTxidStatus> {
    const { txidIndex: currentTxidIndex, merkleroot: currentMerkleroot } =
      await getLatestRailgunTxidData(txidVersion, networkName);
    const { validatedTxidIndex, validatedMerkleroot } =
      await RailgunTxidMerkletreeManager.getValidatedRailgunTxidStatus(
        networkName,
        txidVersion,
      );
    return {
      currentTxidIndex,
      currentMerkleroot,
      validatedTxidIndex,
      validatedMerkleroot,
    };
  }

  static getTreeAndIndexFromTxidIndex(txidIndex: number): {
    tree: number;
    index: number;
  } {
    return {
      tree: Math.floor(txidIndex / TREE_MAX_ITEMS),
      index: txidIndex % TREE_MAX_ITEMS,
    };
  }

  static async getHistoricalTxidMerkleroot(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    tree: number,
    index: number,
  ) {
    return getRailgunTxidMerkleroot(txidVersion, networkName, tree, index);
  }

  static async updateValidatedRailgunTxidStatusSafe(
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    txidStatusOtherNode: RailgunTxidStatus,
  ): Promise<void> {
    try {
      return await RailgunTxidMerkletreeManager.updateValidatedRailgunTxidStatus(
        nodeURL,
        networkName,
        txidVersion,
        txidStatusOtherNode,
      );
    } catch (err) {
      // no op
      return;
    }
  }

  static async verifySignatureAndUpdateValidatedRailgunTxidStatus(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    txidIndex: number,
    merkleroot: string,
    signature: string,
    listKey: string,
  ) {
    if (
      !(await verifyTxidMerkleroot(txidIndex, merkleroot, signature, listKey))
    ) {
      dbg('Invalid signature: txid merkleroot');
      return;
    }

    const nodeURL = nodeURLForListKey(listKey);
    if (!isDefined(nodeURL)) {
      return;
    }

    return RailgunTxidMerkletreeManager.updateValidatedRailgunTxidStatus(
      nodeURL,
      networkName,
      txidVersion,
      {
        currentMerkleroot: merkleroot,
        currentTxidIndex: txidIndex,
        validatedMerkleroot: merkleroot,
        validatedTxidIndex: txidIndex,
      },
    );
  }

  static async updateValidatedRailgunTxidStatus(
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    txidStatusOtherNode: RailgunTxidStatus,
  ): Promise<void> {
    const {
      validatedTxidIndex: validatedTxidIndexA,
      currentTxidIndex: currentTxidIndexA,
    } = await this.getRailgunTxidStatus(networkName, txidVersion);
    const {
      currentTxidIndex: currentTxidIndexB,
      currentMerkleroot: currentMerklerootB,
    } = txidStatusOtherNode;

    if (!isDefined(currentTxidIndexA)) {
      throw new Error('Requires node current index');
    }
    if (!isDefined(currentTxidIndexB) || !isDefined(validatedTxidIndexA)) {
      throw new Error('Requires other node current/validated indices');
    }

    // Update validated txid if the other node has a current value > this node's validated value.
    const shouldUpdateValidatedTxid = currentTxidIndexB > validatedTxidIndexA;
    if (!shouldUpdateValidatedTxid) {
      throw new Error('Current node is already up to date');
    }

    // Validate the smaller of the current indices on the two nodes
    const txidIndexToValidate = Math.min(currentTxidIndexA, currentTxidIndexB);
    const { tree, index } =
      this.getTreeAndIndexFromTxidIndex(txidIndexToValidate);

    const historicalMerkleroot =
      await RailgunTxidMerkletreeManager.getHistoricalTxidMerkleroot(
        networkName,
        txidVersion,
        tree,
        index,
      );
    if (!isDefined(historicalMerkleroot)) {
      throw new Error('Historical merkleroot does not exist');
    }

    const isPreValidated = currentMerklerootB === historicalMerkleroot;

    const isValid: boolean =
      isPreValidated ||
      (await POINodeRequest.validateRailgunTxidMerkleroot(
        nodeURL,
        networkName,
        txidVersion,
        tree,
        index,
        historicalMerkleroot,
      ));
    if (isValid) {
      // Valid. Update validated txid.
      const db = new RailgunTxidMerkletreeStatusDatabase(
        networkName,
        txidVersion,
      );
      await db.saveValidatedTxidStatus(
        txidIndexToValidate,
        historicalMerkleroot,
      );
      await PushSync.sendNodeRequestToAllLists(async nodeURLToSend => {
        if (nodeURLToSend === nodeURL) {
          return;
        }
        // TODO: We shouldn't send from nodes without lists.
        // The receiving nodes will dismiss the request.
        await POINodeRequest.submitValidatedTxidAndMerkleroot(
          nodeURLToSend,
          networkName,
          txidVersion,
          txidIndexToValidate,
          historicalMerkleroot,
        );
      });
      return;
    }

    dbg(
      `Merkleroot invalid: ${historicalMerkleroot} (txidIndex ${txidIndexToValidate}) with node ${nodeURL} - re-syncing txid tree from txidIndex ${validatedTxidIndexA}`,
    );

    // Invalid. Clear the merkletree after validatedTxidIndexA, and re-sync.
    const clearFromTxidIndex = validatedTxidIndexA ?? -1;
    await this.resetRailgunTxidsAfterTxidIndex(
      networkName,
      txidVersion,
      clearFromTxidIndex,
    );
  }
}
