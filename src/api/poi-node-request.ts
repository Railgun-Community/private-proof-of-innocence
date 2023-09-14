import { NETWORK_CONFIG, NetworkName } from '@railgun-community/shared-models';
import axios from 'axios';
import { NodeStatusAllNetworks } from '../models/api-types';
import { SignedPOIEvent } from '../models/poi-types';

export class POINodeRequest {
  private static getNodeRouteURL = (url: string, route: string): string => {
    return `${url}/${route}`;
  };

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
    const isValid: boolean = await axios.get(url, {
      params: {
        tree,
        index,
        merkleroot,
      },
    });
    return isValid;
  };

  static getNodeStatusAllNetworks = async (
    nodeURL: string,
  ): Promise<NodeStatusAllNetworks> => {
    const route = `node-status`;
    const url = POINodeRequest.getNodeRouteURL(nodeURL, route);
    const nodeStatusAllNetworks: NodeStatusAllNetworks = await axios.get(url);
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
    const poiEvents: SignedPOIEvent[] = await axios.get(url);
    return poiEvents;
  };
}
