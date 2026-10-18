import { useEffect } from 'react';
import { useScoreStore } from '@/modules/editor';
import { buttonStyles as b } from '@/shared/components/overlay';
import { useImportWarnings } from '../store/warnings.store';
import { S } from '../strings';
import styles from './import.module.css';

/** Avisos de la última importación; se cierran con "Entendido" o al editar (formats-spec 17). */
export function ImportWarnings() {
  const { list, set } = useImportWarnings();
  const edited = useScoreStore((s) => s.revision !== s.loadedRevision);
  useEffect(() => {
    if (edited && list.length) set([]);
  }, [edited, list.length, set]);
  if (!list.length) return null;
  return (
    <div className={styles.warnings} role="status">
      <b>{S.warningsTitle}</b>
      <ul>
        {list.map((w) => (
          <li key={w.code}>{S.warnings[w.code](w.detail)}</li>
        ))}
      </ul>
      <button type="button" className={b.btn} onClick={() => set([])}>
        {S.gotIt}
      </button>
    </div>
  );
}
