import { useSaveStore } from '../store/save.store';
import { S } from '../strings';
import styles from './library.module.css';

/** "Guardada en este dispositivo" / "Guardando…" / error (library-spec 6.4, 6.6). */
export function SaveBadge() {
  const state = useSaveStore((s) => s.state);
  const memoryOnly = useSaveStore((s) => s.memoryOnly);
  if (memoryOnly)
    return (
      <p className={styles.err} role="alert">
        {S.storageUnavailable}
      </p>
    );
  if (state.kind === 'error')
    return (
      <p className={styles.err} role="alert">
        {state.message}
      </p>
    );
  const text = state.kind === 'saving' ? S.saving : state.kind === 'saved' ? `✓ ${S.saved}` : S.unsaved;
  return <span className={styles.muted}>{text}</span>;
}
