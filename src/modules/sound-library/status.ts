const listeners = new Set<() => void>();
let message = 'Sonido sintetizado';
export const soundStatus = {
  get: () => message,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  set(value: string) {
    message = value;
    listeners.forEach((fn) => fn());
  },
};
