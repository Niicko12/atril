import { useEffect, useState } from 'react';
import { deleteDatabase } from '@/infra/idb';
import { canShareFiles, saveBlob, shareBlob } from '@/infra/download';
import { buttonStyles as b } from '@/shared/components/overlay';
import { useArmed } from '@/shared/hooks/use-armed';
import { BackupError, backupFileName, exportBackup, importBackup } from '../services/backup.service';
import { useLibraryVersion } from '../services/autosave.service';
import { shouldRemindBackup, storageUsage } from '../services/persistence';
import { prefs } from '../services/prefs.service';
import { S } from '../strings';
import { formatDate } from './score-row';
import styles from './library.module.css';

const ERRORS: Record<BackupError['kind'], string> = {
  invalid: S.backupInvalid,
  future: S.backupFuture,
  too_large: S.backupTooLarge,
};
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;

interface Props {
  latestUpdate: string | null;
}

/** Copia de respaldo, espacio usado y borrar todo (library-spec 11-13, 16). */
export function BackupPanel({ latestUpdate }: Props) {
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [last, setLast] = useState<{ at: string | null; count: number }>({ at: null, count: 0 });
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [ready, setReady] = useState<{ blob: Blob; name: string } | null>(null);
  const bump = useLibraryVersion((s) => s.bump);
  const wipe = useArmed(() => void deleteDatabase().then(() => location.reload()));

  useEffect(() => {
    void Promise.all([prefs.get('lastBackupAt'), prefs.get('lastBackupCount'), storageUsage()]).then(
      ([at, count, u]) => {
        setLast({ at, count });
        setUsage(u);
      },
    );
  }, []);

  const make = async () => {
    const { blob, count } = await exportBackup(false);
    const name = backupFileName();
    const at = new Date().toISOString();
    await prefs.set('lastBackupAt', at);
    await prefs.set('lastBackupCount', count);
    setLast({ at, count });
    setMsg({ text: S.backupReady(count), ok: true });
    if (canShareFiles()) setReady({ blob, name });
    else saveBlob(name, blob);
  };
  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      setMsg({ text: S.restored(await importBackup(new Uint8Array(await file.arrayBuffer()))), ok: true });
      bump();
    } catch (e) {
      setMsg({ text: e instanceof BackupError ? ERRORS[e.kind] : S.backupInvalid, ok: false });
    }
  };

  return (
    <div className={styles.block}>
      <span className={styles.label}>{S.backup}</span>
      {shouldRemindBackup(last.at, latestUpdate) && (
        <p className={styles.reminder}>{last.at ? S.reminder : S.reminderNever}</p>
      )}
      <div className={styles.inline}>
        <button type="button" className={`${b.btn} ${b.primary}`} onClick={() => void make()}>
          {S.makeBackup}
        </button>
        <label className={`${b.btn} ${styles.file}`}>
          {S.restoreBackup}
          <input
            type="file"
            accept=".zip,.json,application/zip,application/json"
            onChange={(e) => void restore(e.target.files?.[0])}
          />
        </label>
        {ready && (
          <>
            <button
              type="button"
              className={b.btn}
              onClick={() =>
                void shareBlob(ready.name, ready.blob, 'Atril').catch(() => saveBlob(ready.name, ready.blob))
              }
            >
              {S.share}
            </button>
            <button type="button" className={b.btn} onClick={() => saveBlob(ready.name, ready.blob)}>
              {S.download}
            </button>
          </>
        )}
      </div>
      <p className={styles.muted}>{last.at ? S.lastBackup(formatDate(last.at), last.count) : S.noBackup}</p>
      {msg && (
        <p className={msg.ok ? styles.ok : styles.err} aria-live="polite">
          {msg.text}
        </p>
      )}
      <div className={styles.inline}>
        {usage && (
          <span className={styles.muted}>
            {S.usage(mb(usage.usage))}
            {usage.usage / usage.quota > 0.8 ? ` · ${S.usageHigh}` : ''}
          </span>
        )}
        <button type="button" className={`${b.btn} ${b.warn}`} onClick={wipe.press}>
          {wipe.armed ? S.deleteAllConfirm : S.deleteAll}
        </button>
      </div>
    </div>
  );
}
