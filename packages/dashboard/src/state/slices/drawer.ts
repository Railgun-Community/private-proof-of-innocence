import { StateCreator } from 'zustand';

export type DrawerSlice = {
  isOpen: boolean;
  closeDrawer: () => void;
  openDrawer: () => void;
  toggleDrawer: () => void;
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
  toggleDrawer: () => set(state => ({ isOpen: !state.isOpen })),
});
