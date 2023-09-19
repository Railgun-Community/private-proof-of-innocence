import { StateCreator } from 'zustand';

export type DrawerSlice = {
  isOpen: boolean;
  closeDrawer: () => void;
  openDrawer: () => void;
};

export const createDrawerSlice: StateCreator<
  DrawerSlice,
  [],
  [],
  DrawerSlice
> = set => ({
  isOpen: false,
  closeDrawer: () => set(() => ({ isOpen: false })),
  openDrawer: () => set(() => ({ isOpen: true })),
});
