import { create } from 'zustand';
import type { PolyNote, RawNote, TimelineEntry } from '@/core/analysis';

/** Resultado del último análisis aplicado al editor: permite "Reajustar ritmo" y, en S6, el seguimiento (F16). */
export interface EarSession {
  raw: RawNote[];
  origin: number | null;
  timeline: TimelineEntry[];
  revisionAtImport: number;
  scoreId?: string;
  events?: PolyNote[];
  withChords?: boolean;
}

export const useEarSession = create<{
  session: EarSession | null;
  set(s: EarSession | null): void;
  setChords(value: boolean): void;
}>((set) => ({
  session: null,
  set: (session) => set({ session }),
  setChords: (value) => set((s) => (s.session?.events ? { session: { ...s.session, withChords: value } } : {})),
}));
