import { useEffect, useState } from 'react';

/** Confirmación por segundo toque: el primero arma, el segundo confirma; se desarma solo (editor-spec 11.1). */
export function useArmed(onConfirm: () => void, timeoutMs = 3500): { armed: boolean; press(): void } {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), timeoutMs);
    return () => clearTimeout(t);
  }, [armed, timeoutMs]);
  return {
    armed,
    press() {
      if (armed) {
        setArmed(false);
        onConfirm();
      } else setArmed(true);
    },
  };
}
