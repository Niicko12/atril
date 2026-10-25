import { useCallback, useMemo, useRef } from 'react';
import type { AbcElem, ClickListener, ClickListenerAnalysis, ClickListenerDrag } from 'abcjs';
import { buildAbc, LETTERS, MIDI_MAX, MIDI_MIN, measureCount, meterOf, outOfRangeIndices, spell } from '@/core';
import type { Timbre } from '@/core';
import { selectEffectiveView, selectInstrument, useScoreStore } from '@/modules/editor';
import { playbackEngine } from '@/modules/playback';
import { useAbcRender } from '../hooks/use-abc-render';
import { useHighlights, usePlayHighlight } from '../hooks/use-highlights';
import { useHorizontalNoteDrag } from '../hooks/use-horizontal-note-drag';
import { scoreRenderOptions, showsTab } from '../render-options';
import { S } from '../strings';
import styles from './score-sheet.module.css';

function draggedMidi(pitch: number, staffSteps: number, transpose: number, fifths: number): number | undefined {
  const current = spell(pitch + transpose, fifths);
  const target = current.octave * 7 + LETTERS.indexOf(current.letter) - staffSteps;
  let result: number | undefined;
  let distance = Number.POSITIVE_INFINITY;
  for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
    const written = spell(midi + transpose, fifths);
    if (written.octave * 7 + LETTERS.indexOf(written.letter) !== target) continue;
    const candidateDistance = Math.abs(midi - pitch);
    if (candidateDistance < distance) {
      result = midi;
      distance = candidateDistance;
    }
  }
  return result;
}

function applyDraggedPitch(input: {
  index: number | undefined;
  staffSteps: number;
  transpose: number;
  fifths: number;
}) {
  const store = useScoreStore.getState();
  const note = store.score.notes[input.index ?? -1];
  if (input.index != null && note?.p != null && input.staffSteps !== 0) {
    const candidate = draggedMidi(note.p, input.staffSteps, input.transpose, input.fifths);
    if (candidate != null) store.moveNoteToPitch(input.index, candidate);
  }
}

function applyScoreClick(input: {
  index: number | undefined;
  staffSteps: number;
  transpose: number;
  fifths: number;
  timbre: Timbre;
}) {
  const store = useScoreStore.getState();
  store.select(input.index ?? -1);
  applyDraggedPitch(input);
  const now = useScoreStore.getState();
  const pitch = now.score.notes[now.selection]?.p;
  if (now.selection >= 0 && pitch != null) playbackEngine.preview(pitch, input.timbre, now.score.instrumentId);
}

/** Hoja con la partitura dibujada por abcjs; tocar una nota la selecciona (notation-core-spec 12). */
export function ScoreSheet() {
  const target = useRef<HTMLDivElement>(null);
  const horizontalGesture = useRef(false);
  const score = useScoreStore((s) => s.score);
  const selection = useScoreStore((s) => s.selection);
  const instrument = useScoreStore(selectInstrument);
  const moveNotePosition = useScoreStore((s) => s.moveNotePosition);
  const view = useScoreStore(selectEffectiveView);

  const built = useMemo(() => buildAbc(score, instrument, view, { names: score.showNames }), [score, instrument, view]);
  const outOfRange = useMemo(
    () => outOfRangeIndices(score.notes, instrument.low, instrument.high),
    [score.notes, instrument],
  );

  // abcjs defines a five-argument listener; the final drag payload reports diatonic staff steps.
  const onClick = useCallback<ClickListener>(
    // eslint-disable-next-line max-params
    (el: AbcElem, _tuneNumber: number, _classes: string, _analysis: ClickListenerAnalysis, drag: ClickListenerDrag) => {
      const idx = built.charMap.get(el.startChar);
      setTimeout(() => {
        if (horizontalGesture.current) return;
        applyScoreClick({
          index: idx,
          staffSteps: drag.step,
          transpose: built.transpose,
          fifths: built.fifths,
          timbre: instrument.timbre,
        });
      }, 0);
    },
    [built.charMap, built.fifths, built.transpose, instrument.timbre],
  );
  const tab = showsTab(score.showTab, instrument, view) ? instrument : null;
  const options = useCallback(
    (w: number) => ({ ...scoreRenderOptions('screen', w, tab), clickListener: onClick }),
    [tab, onClick],
  );
  const { noteElements, tick, error } = useAbcRender(target, built.abc, built.charMap, options);
  useHorizontalNoteDrag(target, noteElements, moveNotePosition, horizontalGesture);
  useHighlights(noteElements, tick, selection, outOfRange);
  usePlayHighlight(noteElements);

  const label = S.sheetLabel(score.title, instrument.name, measureCount(score.notes, meterOf(score.meter)));
  return (
    <section className={styles.sheet}>
      <div className={styles.paper}>
        <div ref={target} role="img" aria-label={label} />
        {error === 'render' && <p className={styles.error}>{S.renderFailed}</p>}
      </div>
      {!score.notes.length && <div className={styles.empty}>{S.empty}</div>}
    </section>
  );
}
