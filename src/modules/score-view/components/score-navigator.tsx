import { useEffect, useState } from 'react';
import { measureCount, meterOf } from '@/core';
import { selectInstrument, useScoreStore } from '@/modules/editor';
import { playbackEngine, usePlayback } from '@/modules/playback';
import { PracticeControls } from '@/modules/practice';
import { measureOfNote, playbackAtMeasure } from '../measure-navigation';
import { S } from '../strings';
import styles from './score-navigator.module.css';

/** Compases e inicios de escucha sin modificar la partitura. */
export function ScoreNavigator() {
  const score = useScoreStore((state) => state.score);
  const selection = useScoreStore((state) => state.selection);
  const select = useScoreStore((state) => state.select);
  const instrument = useScoreStore(selectInstrument);
  const { playing } = usePlayback();
  const bar = meterOf(score.meter).bar;
  const count = measureCount(score.notes, meterOf(score.meter));
  const [cursor, setCursor] = useState({
    notes: score.notes,
    selection,
    measure: measureOfNote(score.notes, selection, bar),
    bar,
    id: score.id,
  });
  useEffect(() => {
    if (cursor.selection >= 0)
      document
        .querySelector<HTMLElement>('[role="img"] .sel')
        ?.scrollIntoView?.({ block: 'center', inline: 'nearest' });
  }, [cursor]);
  const sameCursor =
    cursor.notes === score.notes && cursor.selection === selection && cursor.bar === bar && cursor.id === score.id;
  const current = sameCursor ? cursor.measure : measureOfNote(score.notes, selection, bar);
  const measure = Math.max(0, Math.min(count - 1, current));
  const navigate = (target: number) => {
    const next = Math.max(0, Math.min(count - 1, target));
    const { fromIndex } = playbackAtMeasure(score.notes, next, bar);
    if (fromIndex < 0) return;
    playbackEngine.stopAll();
    if (selection !== fromIndex) select(fromIndex);
    setCursor({ notes: score.notes, selection: fromIndex, measure: next, bar, id: score.id });
  };
  const play = (fromIndex: number, notes = score.notes) => {
    playbackEngine.play({
      notes,
      fromIndex,
      tempo: score.tempo,
      timbre: instrument.timbre,
      instrumentId: score.instrumentId,
    });
  };
  const playMeasure = () => {
    const segment = playbackAtMeasure(score.notes, measure, bar);
    if (segment.fromIndex >= 0) play(segment.fromIndex, [...segment.notes]);
  };

  return (
    <section className={styles.navigator} aria-label={S.navigation}>
      <div className={styles.row}>
        <button type="button" onClick={() => navigate(measure - 1)} disabled={measure === 0 || !count}>
          {S.previousMeasure}
        </button>
        <label className={styles.field}>
          {S.measure}
          <input
            type="number"
            min="1"
            max={Math.max(1, count)}
            value={count ? measure + 1 : ''}
            disabled={!count}
            aria-label={S.goToMeasure}
            onChange={(event) => {
              const value = event.currentTarget.valueAsNumber;
              if (Number.isFinite(value)) navigate(Math.round(value) - 1);
            }}
          />
          <span>{S.ofMeasures(count)}</span>
        </label>
        <button type="button" onClick={() => navigate(measure + 1)} disabled={!count || measure >= count - 1}>
          {S.nextMeasure}
        </button>
      </div>
      <div className={styles.row}>
        <button type="button" onClick={playMeasure} disabled={!count}>
          {S.playMeasure}
        </button>
        <button type="button" onClick={() => play(selection)} disabled={selection < 0 || !count}>
          {S.playSelected}
        </button>
        <button type="button" onClick={() => play(0)} disabled={!count}>
          {S.playBeginning}
        </button>
        {playing && (
          <button type="button" onClick={() => playbackEngine.stopAll()}>
            {S.stop}
          </button>
        )}
      </div>
      <PracticeControls
        key={score.id}
        count={count}
        bar={bar}
        beat={meterOf(score.meter).beat}
        playing={playing}
        onStop={() => playbackEngine.stopAll()}
        onPlay={(practice) =>
          playbackEngine.play({
            notes: score.notes,
            fromIndex: 0,
            tempo: score.tempo,
            timbre: instrument.timbre,
            instrumentId: score.instrumentId,
            practice,
          })
        }
      />
    </section>
  );
}
