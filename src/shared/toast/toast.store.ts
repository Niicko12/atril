import { create } from 'zustand';

export interface ToastAction {
  label: string;
  run(): void;
}

interface ToastState {
  message: string;
  action: ToastAction | null;
  id: number;
  show(message: string, action?: ToastAction): void;
  clear(): void;
}

/** Un toast a la vez; el nuevo reemplaza al anterior (editor-spec 15). */
export const useToastStore = create<ToastState>((set) => ({
  message: '',
  action: null,
  id: 0,
  show: (message, action) => set((s) => ({ message, action: action ?? null, id: s.id + 1 })),
  clear: () => set({ message: '', action: null }),
}));

export const toast = (message: string, action?: ToastAction): void => useToastStore.getState().show(message, action);
