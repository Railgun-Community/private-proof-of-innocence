import {
  NetworkName,
  SingleCommitmentProofsData,
  TXIDVersion,
  isDefined,
} from '@railgun-community/shared-models';
import { ListProviderPOIEventQueue } from '../list-provider/list-provider-poi-event-queue';
import { chainForNetwork, nodeURLForListKey } from '../config/general';
import { POINodeRequest } from '../api/poi-node-request';
import debug from 'debug';
import { PushSync } from '../sync/push-sync';
import { POIMerkletreeManager } from '../poi-events/poi-merkletree-manager';
import {
  POIValidation,
  getBlindedCommitmentForShieldOrTransact,
  hexToBigInt,
} from '@railgun-community/wallet';
import { getGlobalTreePosition } from '@railgun-community/engine';
import { RailgunTxidMerkletreeManager } from '../railgun-txids/railgun-txid-merkletree-manager';

const dbg = debug('poi:transact-proof-mempool');

const VALIDATION_ERROR_TEXT = 'Validation error';

export class SingleCommitmentProofManager {
  static async submitProof(
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    singleCommitmentProofsData: SingleCommitmentProofsData,
  ) {
    const listKeys = Object.keys(singleCommitmentProofsData.pois);
    for (const listKey of listKeys) {
      const filteredSingleCommitmentProofsData: SingleCommitmentProofsData = {
        ...singleCommitmentProofsData,
        pois: { [listKey]: singleCommitmentProofsData.pois[listKey] },
      };

      await SingleCommitmentProofManager.tryAddToList(
        listKey,
        networkName,
        txidVersion,
        filteredSingleCommitmentProofsData,
      );
    }
  }

  private static async pushProofToDestinationNode(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    singleCommitmentProofsData: SingleCommitmentProofsData,
  ): Promise<void> {
    const nodeURL = nodeURLForListKey(listKey);
    if (!isDefined(nodeURL)) {
      return;
    }
    try {
      await PushSync.sendNodeRequest(
        nodeURL,
        async nodeURL => {
          await POINodeRequest.submitSingleCommitmentProof(
            nodeURL,
            networkName,
            txidVersion,
            singleCommitmentProofsData,
          );
        },
        true, // shouldThrow
      );
    } catch (err) {
      dbg(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Error submitting single commitment proof to destination node: ${err.message}`,
      );
      if (!(err instanceof Error)) {
        return;
      }
      if (err.message.includes(VALIDATION_ERROR_TEXT)) {
        // This will throw error for the client, when submitting proof.
        throw err;
      }
    }
  }

  static async tryAddToList(
    listKey: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    filteredSingleCommitmentProofsData: SingleCommitmentProofsData,
  ): Promise<void> {
    if (ListProviderPOIEventQueue.listKey !== listKey) {
      // Immediately push to destination node, by its listKey
      await this.pushProofToDestinationNode(
        listKey,
        networkName,
        txidVersion,
        filteredSingleCommitmentProofsData,
      );
      return;
    }

    dbg('Adding single commitment proof');

    const {
      commitment,
      npk,
      utxoTreeIn,
      utxoTreeOut,
      utxoPositionOut,
      railgunTxid,
      pois,
    } = filteredSingleCommitmentProofsData;

    try {
      // Use internal function instead of POI request.
      POIValidation.init(
        POIMerkletreeManager.validateAllPOIMerklerootsExistWithChain,
      );

      await POIValidation.assertIsValidSpendableTXID(
        listKey,
        txidVersion,
        chainForNetwork(networkName),
        pois,
        [railgunTxid],
        [BigInt(utxoTreeIn)],
      );

      const railgunTxidExists =
        await RailgunTxidMerkletreeManager.checkIfRailgunTxidExists(
          txidVersion,
          networkName,
          railgunTxid,
        );
      if (!railgunTxidExists) {
        throw new Error('Could not find railgun txid');
      }

      const blindedCommitment = getBlindedCommitmentForShieldOrTransact(
        commitment,
        hexToBigInt(npk),
        getGlobalTreePosition(utxoTreeOut, utxoPositionOut),
      );

      ListProviderPOIEventQueue.queueUnsignedPOISingleCommitmentEvent(
        listKey,
        networkName,
        txidVersion,
        blindedCommitment,
      );
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      throw new Error(
        `Invalid spendable txid for single commitment: ${err.message}`,
      );
    }
  }
}
