import { create } from 'zustand';
import type { ImportWarning } from '@/core';

/** Avisos de la última importación; se cierran al editar (formats-spec 17). */
export const useImportWarnings = create<{ list: ImportWarning[]; set(list: ImportWarning[]): void }>((set) => ({
  list: [],
  set: (list) => set({ list }),
}));
