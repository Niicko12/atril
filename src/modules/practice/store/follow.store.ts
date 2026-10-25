import { create } from 'zustand';

export const useFollowStore = create<{ follow: boolean; set: (follow: boolean) => void }>((set) => ({
  follow: false,
  set: (follow) => set({ follow }),
}));
