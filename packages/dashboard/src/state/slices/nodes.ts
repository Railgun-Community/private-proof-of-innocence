import {
  isDefined,
  NodeStatusAllNetworks,
} from '@railgun-community/shared-models';
import { StateCreator } from 'zustand';
import { POINodeRequest } from '@services/poi-node-request';

export type NodesSlice = {
  nodeIp: string | null;
  nodeStatusForAllNetworks: NodeStatusAllNetworks | null;
  setNodeIp: (ip: string) => void;
  getNodeStatusForAllNetworks: () => void;
  clearNodeIp: () => void;
  loadingNodeStatusForAllNetworks: boolean;
  lastRefreshedNodeStatusForAllNetworks: Date | null;
};

export const createNodesSlice: StateCreator<NodesSlice, [], [], NodesSlice> = (
  set,
  get,
) => ({
  nodeIp: 'http://localhost:3010', // TODO: Change this in the future
  setNodeIp: ip => set(() => ({ nodeIp: ip })),
  clearNodeIp: () => set(() => ({ nodeIp: null })),
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
});
