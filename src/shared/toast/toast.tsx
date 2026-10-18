import { useEffect } from 'react';
import { useToastStore } from './toast.store';
import styles from './toast.module.css';

const DURATION_MS = 4000;

export function Toast() {
  const { message, action, id, clear } = useToastStore();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(clear, action ? 5000 : DURATION_MS);
    return () => clearTimeout(t);
  }, [id, message, action, clear]);
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
      {action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            action.run();
            clear();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
