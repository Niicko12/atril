import { create } from 'zustand';

/** Índice de la nota que suena (−1 = ninguna). Lo leen score-view y ear (F16). */
export const usePlaybackPositionStore = create<{ index: number; set(index: number): void }>((set) => ({
  index: -1,
  set: (index) => set((s) => (s.index === index ? s : { index })),
}));
