import { NETWORK_CONFIG, NetworkName } from '@railgun-community/shared-models';
import axios from 'axios';
import { NodeStatusAllNetworks } from '../models/api-types';

export class POINodeRequest {
  private static getNodeURL = (url: string, route: string): string => {
    return `${url}/${route}`;
  };

  static validateRailgunTxidMerkleroot = async (
    node: string,
    networkName: NetworkName,
    tree: number,
    index: number,
    merkleroot: string,
  ): Promise<boolean> => {
    const chain = NETWORK_CONFIG[networkName].chain;
    const route = `validate-txid-merkleroot/${chain.type}/${chain.id}`;
    const url = POINodeRequest.getNodeURL(node, route);
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
    node: string,
  ): Promise<NodeStatusAllNetworks> => {
    const route = `node-status`;
    const url = POINodeRequest.getNodeURL(node, route);
    const nodeStatusAllNetworks: NodeStatusAllNetworks = await axios.get(url);
    return nodeStatusAllNetworks;
  };
}
