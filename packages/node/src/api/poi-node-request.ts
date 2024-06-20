import {
  NETWORK_CONFIG,
  NetworkName,
  TransactProofData,
  NodeStatusAllNetworks,
  TXIDVersion,
  LegacyTransactProofData,
  SingleCommitmentProofsData,
  MerkleProof,
  BlindedCommitmentData,
  POIJSONRPCMethod,
} from '@railgun-community/shared-models';
import axios from 'axios';
import {
  POISyncedListEvent,
  POIsPerBlindedCommitmentMap,
  SignedBlockedShield,
  SignedPOIEvent,
} from '../models/poi-types';
import {
  getListPublicKey,
  signRemoveProof,
  signValidatedTxidMerkleroot,
} from '../util/ed25519';
import { isListProvider } from '../config/general';
import { JsonRpcError, JsonRpcPayload, JsonRpcResult } from 'ethers';

import debug from 'debug';
const dbg = debug('poi-node-request');
export class POINodeRequest {
  private static async jsonRpcRequest<
    Params extends any[] | Record<string, any>,
    ResponseData,
  >(
    nodeURL: string,
    method: POIJSONRPCMethod,
    params: Params,
  ): Promise<ResponseData> {
    const payload: JsonRpcPayload = {
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    };

    dbg(`Making JSON-RPC request to ${nodeURL} - ${JSON.stringify(payload)}`);

    try {
      // Directly use Axios to make the post request
      const response = await axios.post(nodeURL, payload);

      // Ensure the response is in the expected format
      const data: JsonRpcResult | JsonRpcError = response.data;

      // Check if the response contains an error
      if ('error' in data) {
        throw new Error(data.error.message);
      }

      // Assuming the result will always be in the expected ResponseData format
      return data.result as ResponseData;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        throw new Error(
          `${error.message}: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw error;
    }
  }

  static validateRailgunTxidMerkleroot = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    tree: number,
    index: number,
    merkleroot: string,
  ): Promise<boolean> => {
    const method = POIJSONRPCMethod.ValidateTXIDMerkleroot;
    const params = { networkName, txidVersion, tree, index, merkleroot };

    const isValid = await this.jsonRpcRequest<typeof params, boolean>(
      nodeURL,
      method,
      params,
    );
    return isValid;
  };

  static getNodeStatusAllNetworks = async (
    nodeURL: string,
  ): Promise<NodeStatusAllNetworks> => {
    dbg(`Getting node status for all networks from ${nodeURL}`);

    const method = POIJSONRPCMethod.NodeStatus;

    const nodeStatusAllNetworks = await this.jsonRpcRequest<
      object,
      NodeStatusAllNetworks
    >(nodeURL, method, {});

    return nodeStatusAllNetworks;
  };

  static getPOIListEventRange = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    startIndex: number,
    endIndex: number,
  ): Promise<POISyncedListEvent[]> => {
    const method = POIJSONRPCMethod.POIEvents;
    const chain = NETWORK_CONFIG[networkName].chain;

    const params = {
      chainType: chain.type.toString(),
      chainID: chain.id.toString(),
      txidVersion,
      listKey,
      startIndex,
      endIndex,
    };
    const poiEvents = await this.jsonRpcRequest<
      typeof params,
      POISyncedListEvent[]
    >(nodeURL, method, params);
    return poiEvents;
  };

  static getPOIMerkletreeLeaves = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    startIndex: number,
    endIndex: number,
  ): Promise<string[]> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.POIMerkletreeLeaves;
    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      listKey,
      startIndex,
      endIndex,
    };

    const poiMerkletreeLeaves = await this.jsonRpcRequest<
      typeof params,
      string[]
    >(nodeURL, method, params);

    return poiMerkletreeLeaves;
  };

  static getFilteredTransactProofs = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    bloomFilterSerialized: string,
  ): Promise<TransactProofData[]> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.TransactProofs;
    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      listKey,
      bloomFilterSerialized,
    };

    const transactProofs = await this.jsonRpcRequest<
      typeof params,
      TransactProofData[]
    >(nodeURL, method, params);
    return transactProofs;
  };

  static getFilteredLegacyTransactProofs = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    bloomFilterSerialized: string,
  ): Promise<LegacyTransactProofData[]> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.LegacyTransactProofs;

    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      bloomFilterSerialized,
    };

    const transactProofs = await this.jsonRpcRequest<
      typeof params,
      LegacyTransactProofData[]
    >(nodeURL, method, params);
    return transactProofs;
  };

  static getFilteredBlockedShields = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    bloomFilterSerialized: string,
  ): Promise<SignedBlockedShield[]> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.BlockedShields;

    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      listKey,
      bloomFilterSerialized,
    };

    const signedBlockedShields = await this.jsonRpcRequest<
      typeof params,
      SignedBlockedShield[]
    >(nodeURL, method, params);
    return signedBlockedShields;
  };

  static submitTransactProof = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    transactProofData: TransactProofData,
  ): Promise<void> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.SubmitTransactProof;

    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      listKey,
      transactProofData,
    };

    const response = await this.jsonRpcRequest<typeof params, void>(
      nodeURL,
      method,
      params,
    );
    return response;
  };

  static submitLegacyTransactProof = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    legacyTransactProofData: LegacyTransactProofData,
  ): Promise<void> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.SubmitLegacyTransactProofs;

    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      listKeys: [],
      legacyTransactProofDatas: [legacyTransactProofData],
    };

    const response = await this.jsonRpcRequest<typeof params, void>(
      nodeURL,
      method,
      params,
    );
    return response;
  };

  static submitSingleCommitmentProof = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    singleCommitmentProofsData: SingleCommitmentProofsData,
  ): Promise<void> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.SubmitSingleCommitmentProofs;

    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      singleCommitmentProofsData,
    };

    const response = await this.jsonRpcRequest<typeof params, void>(
      nodeURL,
      method,
      params,
    );
    return response;
  };

  static removeTransactProof = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    blindedCommitmentsOut: string[],
    railgunTxidIfHasUnshield: string,
  ): Promise<void> => {
    if (!isListProvider()) {
      // Cannot sign without list.
      return;
    }

    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.RemoveTransactProof;

    const signature = await signRemoveProof(
      blindedCommitmentsOut,
      railgunTxidIfHasUnshield,
    );

    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      listKey,
      blindedCommitmentsOut,
      railgunTxidIfHasUnshield,
      signature,
    };

    await this.jsonRpcRequest<typeof params, void>(nodeURL, method, params);
  };

  static submitPOIEvent = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    signedPOIEvent: SignedPOIEvent,
    validatedMerkleroot: string,
  ): Promise<void> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.SubmitPOIEvents;

    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      listKey,
      signedPOIEvent,
      validatedMerkleroot,
    };

    const response = await this.jsonRpcRequest<typeof params, void>(
      nodeURL,
      method,
      params,
    );
    return response;
  };

  static getMerkleProofs = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    blindedCommitments: string[],
  ): Promise<MerkleProof[]> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.MerkleProofs;

    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      listKey,
      blindedCommitments,
    };

    const merkleProofs = await this.jsonRpcRequest<
      typeof params,
      MerkleProof[]
    >(nodeURL, method, params);
    return merkleProofs;
  };

  static getPOIStatusPerBlindedCommitment = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    blindedCommitmentDatas: BlindedCommitmentData[],
  ): Promise<POIsPerBlindedCommitmentMap> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.POIsPerBlindedCommitment;

    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      listKey,
      blindedCommitmentDatas,
    };

    const poisPerBlindedCommitment = await this.jsonRpcRequest<
      typeof params,
      POIsPerBlindedCommitmentMap
    >(nodeURL, method, params);
    return poisPerBlindedCommitment;
  };

  static validatePOIMerkleroots = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    listKey: string,
    poiMerkleroots: string[],
  ): Promise<boolean> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.ValidatePOIMerkleroots;

    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      listKey,
      poiMerkleroots,
    };

    const isValid = await this.jsonRpcRequest<typeof params, boolean>(
      nodeURL,
      method,
      params,
    );
    return isValid;
  };

  static submitValidatedTxidAndMerkleroot = async (
    nodeURL: string,
    networkName: NetworkName,
    txidVersion: TXIDVersion,
    txidIndex: number,
    merkleroot: string,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const method = POIJSONRPCMethod.ValidatedTXID;

    const listKey = await getListPublicKey();

    if (!isListProvider()) {
      // Cannot sign without list.
      return;
    }

    const signature = await signValidatedTxidMerkleroot(txidIndex, merkleroot);

    const params = {
      chainID: chain.id.toString(),
      chainType: chain.type.toString(),
      networkName,
      txidVersion,
      txidIndex,
      merkleroot,
      signature,
      listKey,
    };

    await this.jsonRpcRequest<typeof params, void>(nodeURL, method, params);
  };
}
