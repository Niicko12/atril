import { useState } from 'react';
import type { ScoreSummary } from '@/core';
import { getInstrument } from '@/core';
import { buttonStyles as b } from '@/shared/components/overlay';
import { useArmed } from '@/shared/hooks/use-armed';
import { S } from '../strings';
import styles from './library.module.css';

const DAY_MS = 86400000;

/** "hoy, 14:05" · "18 oct" · "18 oct 2025" (library-spec 8.2). */
export function formatDate(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (d.toDateString() === now.toDateString())
    return `hoy, ${d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
  const opts: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  };
  return d.toLocaleDateString('es', opts).replace('.', '');
}

interface RowProps {
  item: ScoreSummary;
  current: boolean;
  onOpen(id: string): void;
  onDuplicate(id: string): void;
  onTrash(id: string): void;
}

export function ScoreRow({ item, current, onOpen, onDuplicate, onTrash }: RowProps) {
  const title = item.title || 'Sin título';
  return (
    <li className={styles.row}>
      <div className={styles.info}>
        <b>{title}</b>
        <span>
          {getInstrument(item.instrumentId).name} · {formatDate(item.updatedAt)}
          {current ? ` · ${S.opened}` : ''}
        </span>
      </div>
      <button
        type="button"
        className={b.btn}
        disabled={current}
        aria-label={`${S.open} ${title}`}
        onClick={() => onOpen(item.id)}
      >
        {S.open}
      </button>
      <button
        type="button"
        className={b.btn}
        aria-label={`${S.duplicate} ${title}`}
        onClick={() => onDuplicate(item.id)}
      >
        {S.duplicate}
      </button>
      <button type="button" className={b.btn} aria-label={`${S.toTrash}: ${title}`} onClick={() => onTrash(item.id)}>
        🗑
      </button>
    </li>
  );
}

interface TrashProps {
  item: ScoreSummary;
  onRestore(id: string): void;
  onPurge(id: string): void;
}

export function TrashRow({ item, onRestore, onPurge }: TrashProps) {
  const purge = useArmed(() => onPurge(item.id));
  const [now] = useState(() => Date.now());
  const days = Math.max(1, Math.ceil(30 - (now - Date.parse(item.deletedAt ?? '')) / DAY_MS));
  return (
    <li className={styles.row}>
      <div className={styles.info}>
        <b>{item.title || 'Sin título'}</b>
        <span>
          {getInstrument(item.instrumentId).name} · {S.expiresIn(days)}
        </span>
      </div>
      <button type="button" className={b.btn} onClick={() => onRestore(item.id)}>
        {S.restore}
      </button>
      <button type="button" className={`${b.btn} ${purge.armed ? b.warn : ''}`} onClick={purge.press}>
        {purge.armed ? S.sure : S.purge}
      </button>
    </li>
  );
}
