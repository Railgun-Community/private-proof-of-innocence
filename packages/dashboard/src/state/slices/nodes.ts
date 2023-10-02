import {
  isDefined,
  NodeStatusAllNetworks,
} from '@railgun-community/shared-models';
import { StateCreator } from 'zustand';
import { AvailableNodes } from '@constants/nodes';
import { POINodeRequest } from '@services/poi-node-request';

export type NodesSlice = {
  nodeIp: AvailableNodes;
  nodeStatusForAllNetworks: NodeStatusAllNetworks | null;
  setNodeIp: (ip: AvailableNodes) => void;
  getNodeStatusForAllNetworks: () => void;
  loadingNodeStatusForAllNetworks: boolean;
  lastRefreshedNodeStatusForAllNetworks: Date | null;
};

export const createNodesSlice: StateCreator<NodesSlice, [], [], NodesSlice> = (
  set,
  get,
) => ({
  nodeIp: AvailableNodes.Local,
  nodeStatusForAllNetworks: null,
  loadingNodeStatusForAllNetworks: false,
  lastRefreshedNodeStatusForAllNetworks: null,
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
});
