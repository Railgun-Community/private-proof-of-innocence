import { StateCreator } from 'zustand';

export type NodesSlice = {
  nodeIp: string | null;
  setNodeIp: (ip: string) => void;
  clearNodeIp: () => void;
};

export const createNodesSlice: StateCreator<
  NodesSlice,
  [],
  [],
  NodesSlice
> = set => ({
  nodeIp: 'http://localhost:3010', // TODO: Change this in the future
  setNodeIp: ip => set(() => ({ nodeIp: ip })),
  clearNodeIp: () => set(() => ({ nodeIp: null })),
});
