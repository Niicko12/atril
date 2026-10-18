import { useCallback, useMemo, useRef } from 'react';
import type { AbcElem } from 'abcjs';
import { buildAbc, measureCount, meterOf, outOfRangeIndices } from '@/core';
import { selectEffectiveView, selectInstrument, useScoreStore } from '@/modules/editor';
import { playbackEngine } from '@/modules/playback';
import { useAbcRender } from '../hooks/use-abc-render';
import { useHighlights, usePlayHighlight } from '../hooks/use-highlights';
import { scoreRenderOptions, showsTab } from '../render-options';
import { S } from '../strings';
import styles from './score-sheet.module.css';

/** Hoja con la partitura dibujada por abcjs; tocar una nota la selecciona (notation-core-spec 12). */
export function ScoreSheet() {
  const target = useRef<HTMLDivElement>(null);
  const score = useScoreStore((s) => s.score);
  const selection = useScoreStore((s) => s.selection);
  const instrument = useScoreStore(selectInstrument);
  const view = useScoreStore(selectEffectiveView);

  const built = useMemo(() => buildAbc(score, instrument, view, { names: score.showNames }), [score, instrument, view]);
  const outOfRange = useMemo(
    () => outOfRangeIndices(score.notes, instrument.low, instrument.high),
    [score.notes, instrument],
  );

  const onClick = useCallback(
    (el: AbcElem) => {
      const idx = built.charMap.get(el.startChar);
      setTimeout(() => {
        const store = useScoreStore.getState();
        store.select(idx ?? -1);
        const now = useScoreStore.getState();
        const p = now.score.notes[now.selection]?.p;
        if (now.selection >= 0 && p != null) playbackEngine.preview(p, instrument.timbre);
      }, 0);
    },
    [built.charMap, instrument.timbre],
  );
  const tab = showsTab(score.showTab, instrument, view) ? instrument : null;
  const options = useCallback(
    (w: number) => ({ ...scoreRenderOptions('screen', w, tab), clickListener: onClick }),
    [tab, onClick],
  );
  const { noteElements, tick, error } = useAbcRender(target, built.abc, built.charMap, options);
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
