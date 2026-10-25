import { useEffect, useState } from 'react';
import { buttonStyles as b } from '@/shared/components/overlay';
import { detectPlatform, shouldShowInstallHint } from '../services/persistence';
import { prefs } from '../services/prefs.service';
import { useSaveStore } from '../store/save.store';
import { S } from '../strings';
import styles from './library.module.css';

/** Sugerencia única de agregar a la pantalla de inicio en iPhone (library-spec 13.2). */
export function InstallHint() {
  const [show, setShow] = useState(false);
  const saved = useSaveStore((s) => s.state.kind === 'saved');
  useEffect(() => {
    if (!saved) return;
    let active = true;
    void Promise.all([prefs.get('installHintShownAt'), prefs.get('installHintDismissed')])
      .then(
        ([shownAt, dismissed]) =>
          active && setShow(shouldShowInstallHint({ platform: detectPlatform(), hasScores: true, shownAt, dismissed })),
      )
      .catch(() => active && setShow(false));
    return () => {
      active = false;
    };
  }, [saved]);
  if (!show) return null;
  const close = (dismissed: boolean) => {
    setShow(false);
    void prefs.set('installHintShownAt', new Date().toISOString());
    if (dismissed) void prefs.set('installHintDismissed', true);
  };
  return (
    <div className={styles.reminder} role="note">
      {S.installHint}{' '}
      <button type="button" className={b.btn} onClick={() => close(true)}>
        {S.gotIt}
      </button>{' '}
      <button type="button" className={b.btn} onClick={() => close(false)}>
        {S.later}
      </button>
    </div>
  );
}
