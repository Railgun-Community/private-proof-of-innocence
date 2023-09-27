import {
  NETWORK_CONFIG,
  NetworkName,
  TransactProofData,
  GetTransactProofsParams,
  GetBlockedShieldsParams,
  NodeStatusAllNetworks,
  ValidateTxidMerklerootParams,
  SubmitTransactProofParams,
} from '@railgun-community/shared-models';
import axios, { AxiosError } from 'axios';
import {
  SignedBlockedShield,
  SignedPOIEvent,
  SubmitPOIEventParams,
  SubmitValidatedTxidAndMerklerootParams,
} from '../models/poi-types';
import debug from 'debug';
import { getListPublicKey, signValidatedTxidMerkleroot } from '../util/ed25519';

const dbg = debug('poi:request');

export class POINodeRequest {
  private static getNodeRouteURL = (url: string, route: string): string => {
    return `${url}/${route}`;
  };

  private static async getRequest<ResponseData>(
    url: string,
  ): Promise<ResponseData> {
    try {
      const { data }: { data: ResponseData } = await axios.get(url);
      return data;
    } catch (err) {
      if (!(err instanceof AxiosError)) {
        throw err;
      }
      const errMessage = err.message;
      dbg(`ERROR ${url} - ${errMessage}`);
      throw new Error(errMessage);
    }
  }

  private static async postRequest<Params, ResponseData>(
    url: string,
    params: Params,
  ): Promise<ResponseData> {
    try {
      const { data }: { data: ResponseData } = await axios.post(url, params);
      return data;
    } catch (err) {
      if (!(err instanceof AxiosError)) {
        throw err;
      }
      const errMessage = `${err.message}: ${err.response?.data}`;
      dbg(`ERROR ${url} - ${errMessage}`);
      throw new Error(errMessage);
    }
  }

  static validateRailgunTxidMerkleroot = async (
    nodeURL: string,
    networkName: NetworkName,
    tree: number,
    index: number,
    merkleroot: string,
  ): Promise<boolean> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `validate-txid-merkleroot/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
    const isValid = await POINodeRequest.postRequest<
      ValidateTxidMerklerootParams,
      boolean
    >(url, {
      tree,
      index,
      merkleroot,
    });
    return isValid;
  };

  static getNodeStatusAllNetworks = async (
    nodeURL: string,
  ): Promise<NodeStatusAllNetworks> => {
    const route = `node-status`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const nodeStatusAllNetworks =
      await POINodeRequest.getRequest<NodeStatusAllNetworks>(url);
    return nodeStatusAllNetworks;
  };

  static getPOIListEventRange = async (
    nodeURL: string,
    networkName: NetworkName,
    listKey: string,
    startIndex: number,
    endIndex: number,
  ): Promise<SignedPOIEvent[]> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `poi-events/${chain.type}/${chain.id}/${listKey}/${startIndex}/${endIndex}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const poiEvents = await POINodeRequest.getRequest<SignedPOIEvent[]>(url);
    return poiEvents;
  };

  static getFilteredTransactProofs = async (
    nodeURL: string,
    networkName: NetworkName,
    listKey: string,
    bloomFilterSerialized: string,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `transact-proofs/${chain.type}/${chain.id}/${listKey}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const transactProofs = await POINodeRequest.postRequest<
      GetTransactProofsParams,
      TransactProofData[]
    >(url, {
      bloomFilterSerialized,
    });
    return transactProofs;
  };

  static getFilteredBlockedShields = async (
    nodeURL: string,
    networkName: NetworkName,
    listKey: string,
    bloomFilterSerialized: string,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `blocked-shields/${chain.type}/${chain.id}/${listKey}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const signedBlockedShields = await POINodeRequest.postRequest<
      GetBlockedShieldsParams,
      SignedBlockedShield[]
    >(url, {
      bloomFilterSerialized,
    });
    return signedBlockedShields;
  };

  static submitTransactProof = async (
    nodeURL: string,
    networkName: NetworkName,
    listKey: string,
    transactProofData: TransactProofData,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `submit-transact-proof/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    await POINodeRequest.postRequest<SubmitTransactProofParams, void>(url, {
      listKey,
      transactProofData,
    });
  };

  static submitPOIEvent = async (
    nodeURL: string,
    networkName: NetworkName,
    listKey: string,
    signedPOIEvent: SignedPOIEvent,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `submit-poi-event/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    await POINodeRequest.postRequest<SubmitPOIEventParams, void>(url, {
      listKey,
      signedPOIEvent,
    });
  };

  static submitValidatedTxidAndMerkleroot = async (
    nodeURL: string,
    networkName: NetworkName,
    txidIndex: number,
    merkleroot: string,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `submit-validated-txid/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const listKey = await getListPublicKey();
    const signature = await signValidatedTxidMerkleroot(txidIndex, merkleroot);

    await POINodeRequest.postRequest<
      SubmitValidatedTxidAndMerklerootParams,
      void
    >(url, {
      txidIndex,
      merkleroot,
      signature,
      listKey,
    });
  };
}
