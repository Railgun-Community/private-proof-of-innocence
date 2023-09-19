import { create } from 'zustand';
import { createDrawerSlice, DrawerSlice } from './slices/drawer';
import { createNodesSlice, NodesSlice } from './slices/nodes';

export const useDrawerStore = create<DrawerSlice>(createDrawerSlice);
export const useNodeStore = create<NodesSlice>(createNodesSlice);
