import { useState } from 'react';
import { SAMPLES, fromSample } from '@/core';
import { useScoreStore } from '@/modules/editor';
import { Overlay, buttonStyles as b } from '@/shared/components/overlay';
import { toast } from '@/shared/toast';
import { useScoreList } from '../hooks/use-score-list';
import { prepareReplace } from '../services/autosave.service';
import { scoreRepository as repo } from '../services/score-repository';
import { S } from '../strings';
import { BackupPanel } from './backup-panel';
import { ScoreRow, TrashRow } from './score-row';
import styles from './library.module.css';

const VISIBLE_SAMPLES = SAMPLES.filter((s) => s.verified || import.meta.env.DEV);

/** "Mis partituras": lista, papelera, ejemplos y respaldo (library-spec 8-12). */
export function LibraryOverlay({ onClose }: { onClose(): void }) {
  const [tab, setTab] = useState<'scores' | 'trash'>('scores');
  const list = useScoreList();
  const currentId = useScoreStore((s) => s.score.id);
  const instrumentId = useScoreStore((s) => s.score.instrumentId);

  const replaceWith = async (
    load: () => Promise<Parameters<ReturnType<typeof useScoreStore.getState>['replaceScore']>[0] | null>,
  ) => {
    if (!(await prepareReplace())) return;
    const next = await load();
    if (!next) return;
    useScoreStore.getState().replaceScore(next);
    onClose();
    scrollTo({ top: 0 });
  };
  const trash = async (id: string) => {
    await repo.softDelete(id);
    list.refresh();
    toast(S.movedToTrash, { label: S.undo, run: () => void repo.restore(id).then(list.refresh) });
  };
  const act = (fn: (id: string) => Promise<unknown>, done?: string) => async (id: string) => {
    await fn(id);
    list.refresh();
    if (done) toast(done);
  };

  return (
    <Overlay title={S.title} closeLabel={S.close} onClose={onClose}>
      <p className={styles.muted}>{S.intro}</p>
      <div className={styles.seg} role="tablist">
        {(['scores', 'trash'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {S.tabs[t]}
          </button>
        ))}
      </div>
      {list.unreadable > 0 && <p className={styles.err}>{S.unreadable(list.unreadable)}</p>}
      {tab === 'scores' ? (
        <ul className={styles.list} role="tabpanel">
          {!list.loading && !list.items.length && (
            <li className={styles.row}>
              <span className={styles.muted}>{S.empty}</span>
            </li>
          )}
          {list.items.map((item) => (
            <ScoreRow
              key={item.id}
              item={item}
              current={item.id === currentId}
              onOpen={(id) => void replaceWith(() => repo.get(id))}
              onDuplicate={(id) => void act(repo.duplicate.bind(repo), S.copied)(id)}
              onTrash={(id) => void trash(id)}
            />
          ))}
        </ul>
      ) : (
        <ul className={styles.list} role="tabpanel">
          {!list.trash.length && (
            <li className={styles.row}>
              <span className={styles.muted}>{S.trashEmpty}</span>
            </li>
          )}
          {list.trash.map((item) => (
            <TrashRow
              key={item.id}
              item={item}
              onRestore={(id) => void act(repo.restore, S.restoredOne)(id)}
              onPurge={(id) => void act(repo.purge)(id)}
            />
          ))}
        </ul>
      )}
      <div className={styles.block}>
        <span className={styles.label}>{S.samples}</span>
        <ul className={styles.list}>
          {VISIBLE_SAMPLES.map((s) => (
            <li key={s.title} className={styles.row}>
              <div className={styles.info}>
                <b>{s.title}</b>
                <span>{s.composer}</span>
              </div>
              <button
                type="button"
                className={b.btn}
                onClick={() => void replaceWith(async () => fromSample(s, instrumentId))}
              >
                {S.open}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <BackupPanel latestUpdate={list.items[0]?.updatedAt ?? null} />
    </Overlay>
  );
}
