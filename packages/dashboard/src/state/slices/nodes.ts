import {
  isDefined,
  NetworkName,
  NodeStatusAllNetworks,
  NodeStatusForNetwork,
} from '@railgun-community/shared-models';
import { StateCreator } from 'zustand';
import { AvailableNodes, availableNodesArray } from '@constants/nodes';
import { POINodeRequest } from '@services/poi-node-request';

export type NodesSlice = {
  nodeIp: AvailableNodes;
  nodeStatusForAllNetworks: NodeStatusAllNetworks | null;
  allNodesData: NodeStatusForNetwork[] | null;
  setNodeIp: (ip: AvailableNodes) => void;
  getNodeStatusForAllNetworks: () => void;
  getAllNodesData: () => void;
  refreshNode: () => void;
  loadingNodeStatusForAllNetworks: boolean;
  refreshingNode: boolean;
  lastRefreshedNodeStatusForAllNetworks: Date | null;
  currentNetwork: NetworkName;
};

// TODO: Add better naming to all variables and functions.

export const createNodesSlice: StateCreator<NodesSlice, [], [], NodesSlice> = (
  set,
  get,
) => ({
  nodeIp: AvailableNodes.Blank, //TODO: Change this if needed
  nodeStatusForAllNetworks: null,
  currentNetwork: NetworkName.EthereumGoerli, //TODO: Change this.
  allNodesData: null,
  refreshingNode: false,
  loadingNodeStatusForAllNetworks: false,
  lastRefreshedNodeStatusForAllNetworks: null,
  getAllNodesData: async () => {
    let allNodesData: NodeStatusForNetwork[] = [];
    // This is for current network
    const currentNetwork = get().currentNetwork;

    for (const node of availableNodesArray) {
      const data = await POINodeRequest.getNodeStatusAllNetworks(node);
      const serializedData = data.forNetwork[currentNetwork];
      if (serializedData) {
        allNodesData.push(serializedData);
      }
    }
    set(() => {
      return { allNodesData };
    });
  },
  getNodeStatusForAllNetworks: async () => {
    set(() => ({ loadingNodeStatusForAllNetworks: true }));
    const nodeIp = get().nodeIp;

    if (isDefined(nodeIp)) {
      const currentTime = new Date();
      const data = await POINodeRequest.getNodeStatusAllNetworks(nodeIp);
      set(() => {
        return {
          nodeStatusForAllNetworks: data,
          lastRefreshedNodeStatusForAllNetworks: currentTime,
          loadingNodeStatusForAllNetworks: false,
        };
      });
    } else {
      set(() => ({ nodeStatusForAllNetworks: null }));
    }
  },
  setNodeIp: (ip: AvailableNodes) => {
    set(() => ({ nodeIp: ip }));
    get().getNodeStatusForAllNetworks();
  },
  refreshNode: async () => {
    set(() => ({ refreshingNode: true }));

    const nodeIp = get().nodeIp;

    if (isDefined(nodeIp)) {
      const currentTime = new Date();
      const data = await POINodeRequest.getNodeStatusAllNetworks(nodeIp);
      set(() => {
        return {
          nodeStatusForAllNetworks: data,
          lastRefreshedNodeStatusForAllNetworks: currentTime,
          refreshingNode: false,
        };
      });
    }
  },
});
