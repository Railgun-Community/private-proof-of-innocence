import { NETWORK_CONFIG, NetworkName } from '@railgun-community/shared-models';
import axios from 'axios';
import {
  GetShieldProofsParams,
  GetTransactProofsParams,
  NodeStatusAllNetworks,
  ValidateTxidMerklerootParams,
} from '../models/api-types';
import { SignedPOIEvent } from '../models/poi-types';
import { ShieldProofData, TransactProofData } from '../models/proof-types';
import debug from 'debug';

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
      const errMessage = `${err.message}: ${err.response.data}`;
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
      const errMessage = `${err.message}: ${err.response.data}`;
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

  static getFilteredShieldProofs = async (
    nodeURL: string,
    networkName: NetworkName,
    bloomFilterSerialized: string,
  ) => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `shield-proofs/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);

    const shieldProofs = await POINodeRequest.postRequest<
      GetShieldProofsParams,
      ShieldProofData[]
    >(url, {
      bloomFilterSerialized,
    });
    return shieldProofs;
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
}
