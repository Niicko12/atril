import { create } from 'zustand';
export type EditorMode = 'piano' | 'fret' | 'names';

// Semana 3: en memoria. Se persiste en prefs (IndexedDB) con el módulo library (semana 4, library-spec 15).
interface ModeState {
  mode: EditorMode;
  setMode(mode: EditorMode): void;
}

export const useModeStore = create<ModeState>((set) => ({ mode: 'piano', setMode: (mode) => set({ mode }) }));
