import { NetworkName, TXIDVersion } from '@railgun-community/shared-models';
import { TransactProofPerListMempoolDatabase } from '../database/databases/transact-proof-per-list-mempool-database';
import { TransactProofMempoolCache } from './transact-proof-mempool-cache';
import debug from 'debug';
import { verifyRemoveProof } from '../util/ed25519';
import { TransactProofEventMatcher } from './transact-proof-event-matcher';
import { POINodeRequest } from '../api/poi-node-request';
import { PushSync } from '../sync/push-sync';
import { isListProvider } from '../config/general';

const dbg = debug('poi:transact-proof-mempool');

export class TransactProofMempoolPruner {
  /**
   * Removes a proof from the mempool if all other blinded commitments have been added.
   *
   * @param listKey
   * @param networkName
   * @param txidVersion
   * @param blindedCommitment
   * @returns `void` if !existingProof or !orderedEventsExist
   */
  static async removeProofIfAllOtherBlindedCommitmentsAdded(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitment: string,
  ) {
    const db = new TransactProofPerListMempoolDatabase(
      networkName,
      txidVersion,
    );
    const existingProof =
      await db.getProofContainingBlindedCommitmentOrRailgunTxidIfHasUnshield(
        listKey,
        blindedCommitment,
      );
    if (!existingProof) {
      return;
    }

    const orderedEventsExist =
      await TransactProofEventMatcher.hasOrderedEventForEveryBlindedCommitment(
        listKey,
        networkName,
        txidVersion,
        existingProof.blindedCommitmentsOut,
        existingProof.railgunTxidIfHasUnshield,
      );
    if (orderedEventsExist) {
      await this.removeProof(
        listKey,
        networkName,
        txidVersion,
        existingProof.blindedCommitmentsOut,
        existingProof.railgunTxidIfHasUnshield,
        true, // shouldSendNodeRequest
      );
    }
  }

  /**
   * Removes a proof from the mempool, and sends a node request to remove it from other nodes.
   *
   * @param listKey
   * @param networkName
   * @param txidVersion
   * @param blindedCommitmentsOut
   * @param railgunTxidIfHasUnshield
   * @param shouldSendNodeRequest
   * @returns `void` if error thrown or not list provider
   */
  static async removeProof(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitmentsOut: string[],
    railgunTxidIfHasUnshield: string,
    shouldSendNodeRequest: boolean,
  ) {
    try {
      TransactProofMempoolCache.removeFromCache(
        listKey,
        networkName,
        txidVersion,
        blindedCommitmentsOut,
        railgunTxidIfHasUnshield,
      );

      const db = new TransactProofPerListMempoolDatabase(
        networkName,
        txidVersion,
      );
      await db.deleteProof(
        listKey,
        blindedCommitmentsOut,
        railgunTxidIfHasUnshield,
      );

      // If not from removeProofSigned(), then send node request to remove from other nodes.
      if (shouldSendNodeRequest) {
        if (!isListProvider()) {
          dbg(
            `WARNING: removeProof(): Not sending remove requests to all nodes, !isListProvider() - ${listKey})`,
          );
          // Cannot sign without list.
          return;
        }

        await PushSync.sendNodeRequestToAllNodes(async nodeURL => {
          await POINodeRequest.removeTransactProof(
            nodeURL,
            networkName,
            txidVersion,
            listKey,
            blindedCommitmentsOut,
            railgunTxidIfHasUnshield,
          );
        });
      }
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      dbg(
        `removeProof(): Error removing from transact proof mempool: ${err.message}`,
      );
      return;
    }
  }

  /**
   * Removes a proof from the mempool if the signature is valid.
   *
   * @param listKey
   * @param networkName
   * @param txidVersion
   * @param blindedCommitmentsOut
   * @param railgunTxidIfHasUnshield
   * @param signature
   * @returns `void` if the signature is invalid, otherwise returns the result of `removeProof()`.
   */
  static async removeProofSigned(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    blindedCommitmentsOut: string[],
    railgunTxidIfHasUnshield: string,
    signature: string,
  ) {
    if (
      !(await verifyRemoveProof(
        blindedCommitmentsOut,
        railgunTxidIfHasUnshield,
        listKey,
        signature,
      ))
    ) {
      dbg(
        `removeProofSigned(): Invalid signature for remove proof - ${listKey}`,
      );
      return;
    }

    return this.removeProof(
      listKey,
      networkName,
      txidVersion,
      blindedCommitmentsOut,
      railgunTxidIfHasUnshield,
      false, // shouldSendNodeRequest
    );
  }
}
