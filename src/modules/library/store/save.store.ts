import { create } from 'zustand';
import type { SaveState } from '../types';

interface SaveStore {
  state: SaveState;
  /** Sin IndexedDB: todo en memoria (library-spec 6.6). */
  memoryOnly: boolean;
  set(state: SaveState): void;
  setMemoryOnly(v: boolean): void;
}

export const useSaveStore = create<SaveStore>((set) => ({
  state: { kind: 'unsaved' },
  memoryOnly: false,
  set: (state) => set({ state }),
  setMemoryOnly: (memoryOnly) => set({ memoryOnly }),
}));
