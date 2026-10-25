import { useEffect, useMemo, useState } from 'react';
import { meterOf, totalUnits, validateScore } from '@/core';
import { selectInstrument, useScoreStore } from '@/modules/editor';
import { playbackEngine, usePlayback } from '@/modules/playback';
import { Overlay, buttonStyles as b } from '@/shared/components/overlay';
import { EventControls } from './event-controls';
import { RollGrid } from './roll-grid';
import { sameNotes, timeline } from '../services/draft';
import type { DraftChange } from '../types';
import { S } from '../strings';
import styles from './piano-roll.module.css';

export function PianoRollOverlay({ onClose }: { onClose(): void }) {
  const [base] = useState(() => {
    const state = useScoreStore.getState();
    return { score: state.score, revision: state.revision, selection: state.selection };
  });
  const [draft, setDraft] = useState(() => ({
    notes: base.score.notes.map((n) => ({ ...n })),
    selection: Math.max(0, base.selection),
  }));
  const [page, setPage] = useState(() =>
    Math.floor(
      (timeline(base.score.notes)[Math.max(0, base.selection)]?.start ?? 0) / (meterOf(base.score.meter).bar * 4),
    ),
  );
  const [unit, setUnit] = useState(0);
  const [error, setError] = useState('');
  const revision = useScoreStore((s) => s.revision);
  const { playing } = usePlayback();
  const bar = meterOf(base.score.meter).bar;
  const pages = Math.max(1, Math.ceil(totalUnits(draft.notes) / (bar * 4)));
  const currentPage = Math.min(page, pages - 1);
  const conflict = revision !== base.revision;
  const changed = !sameNotes(base.score.notes, draft.notes);
  const events = useMemo(() => timeline(draft.notes), [draft.notes]);
  useEffect(() => {
    playbackEngine.stopAll();
    return () => playbackEngine.stopAll();
  }, []);
  useEffect(() => {
    if (conflict) playbackEngine.stopAll();
  }, [conflict]);
  const select = (selection: number) => {
    setDraft((old) => ({ ...old, selection }));
    setPage(Math.floor((events[selection]?.start ?? 0) / (bar * 4)));
  };
  const change = (next: DraftChange) => {
    playbackEngine.stopAll();
    setDraft(next);
    setPage(Math.floor((timeline(next.notes)[next.selection]?.start ?? 0) / (bar * 4)));
    setError('');
  };
  const apply = () => {
    const state = useScoreStore.getState();
    if (state.score.id !== base.score.id || state.revision !== base.revision) return setError(S.conflict);
    try {
      validateScore({ ...state.score, notes: draft.notes });
      if (changed) state.replaceNotesKeepingMeta(draft.notes);
      onClose();
    } catch {
      setError(S.failed);
    }
  };
  const listen = () => {
    if (playing) return playbackEngine.stopAll();
    playbackEngine.play({
      notes: draft.notes,
      fromIndex: Math.max(0, draft.selection),
      tempo: base.score.tempo,
      instrumentId: base.score.instrumentId,
      timbre: selectInstrument(useScoreStore.getState()).timbre,
      onPosition: () => undefined,
    });
  };
  return (
    <Overlay wide title={S.title} closeLabel={S.cancel} onClose={onClose}>
      <details className={styles.instructions}>
        <summary>Cómo editar · {S.gridHelp}</summary>
        <p className={styles.help}>{S.help}</p>
      </details>
      {(conflict || error) && (
        <p role="alert" className={styles.error}>
          {conflict ? S.conflict : error}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" className={b.btn} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
          {S.prev}
        </button>
        <span>
          {S.bars(
            currentPage * 4 + 1,
            Math.min((currentPage + 1) * 4, Math.max(1, Math.ceil(totalUnits(draft.notes) / bar))),
          )}
        </span>
        <button
          type="button"
          className={b.btn}
          disabled={currentPage === pages - 1}
          onClick={() => setPage(currentPage + 1)}
        >
          {S.next}
        </button>
        <label>
          {S.zoom}
          <select value={unit} onChange={(e) => setUnit(Number(e.target.value))}>
            <option value="0">Ajustar a pantalla</option>
            <option value="12">{S.compact}</option>
            <option value="20">{S.normal}</option>
            <option value="28">{S.wide}</option>
          </select>
        </label>
      </div>
      {!draft.notes.length && <p role="status">{S.empty}</p>}
      <div className={styles.workspace}>
        <RollGrid
          notes={draft.notes}
          selected={draft.selection}
          page={currentPage}
          bar={bar}
          unit={unit}
          change={change}
          select={(selection) => setDraft((old) => ({ ...old, selection }))}
        />
        <aside className={styles.inspector} aria-label="Controles de la nota">
          <EventControls notes={draft.notes} selected={draft.selection} change={change} select={select} />
        </aside>
      </div>
      <div className={`${styles.actions} ${styles.footer}`}>
        <button type="button" className={b.btn} disabled={!draft.notes.length || conflict} onClick={listen}>
          {playing ? S.stop : S.listen}
        </button>
        <button
          type="button"
          className={b.btn}
          disabled={!changed}
          onClick={() => change({ notes: base.score.notes.map((n) => ({ ...n })), selection: 0 })}
        >
          {S.reset}
        </button>
        <button type="button" className={`${b.btn} ${b.primary}`} disabled={!changed || conflict} onClick={apply}>
          {S.apply}
        </button>
      </div>
    </Overlay>
  );
}
