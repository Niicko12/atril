import { useState } from 'react';
import { useFollowStore } from '../store/follow.store';
import type { PracticeOptions } from '../types';
import styles from './practice-controls.module.css';

interface Props {
  count: number;
  bar: number;
  beat: number;
  playing: boolean;
  onStop: () => void;
  onPlay: (options: PracticeOptions) => void;
}

export function PracticeControls({ count, bar, beat, playing, onStop, onPlay }: Props) {
  const [start, setStart] = useState(1);
  const [end, setEnd] = useState(count || 1);
  const [speed, setSpeed] = useState(1);
  const [repeat, setRepeat] = useState(true);
  const [metronome, setMetronome] = useState(false);
  const [countIn, setCountIn] = useState(true);
  const follow = useFollowStore((state) => state.follow);
  const setFollow = useFollowStore((state) => state.set);
  const first = Math.max(1, Math.min(count || 1, start));
  const last = Math.max(first, Math.min(count || 1, end));
  const change = (action: () => void) => {
    onStop();
    action();
  };
  const number = (value: number, action: (value: number) => void) => {
    if (Number.isFinite(value)) change(() => action(Math.round(value)));
  };
  return (
    <details className={styles.practice}>
      <summary>Modo práctica</summary>
      <div className={styles.controls}>
        <label>
          Desde compás
          <input
            aria-label="Practicar desde compás"
            type="number"
            min="1"
            max={count || 1}
            value={first}
            onChange={(event) => number(event.currentTarget.valueAsNumber, setStart)}
          />
        </label>
        <label>
          Hasta compás
          <input
            aria-label="Practicar hasta compás"
            type="number"
            min={first}
            max={count || 1}
            value={last}
            onChange={(event) => number(event.currentTarget.valueAsNumber, setEnd)}
          />
        </label>
        <label>
          Velocidad
          <select value={speed} onChange={(event) => change(() => setSpeed(Number(event.target.value)))}>
            <option value="0.5">50 %</option>
            <option value="0.75">75 %</option>
            <option value="1">100 %</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={repeat} onChange={(event) => change(() => setRepeat(event.target.checked))} />{' '}
          Repetir fragmento
        </label>
        <label>
          <input
            type="checkbox"
            checked={metronome}
            onChange={(event) => change(() => setMetronome(event.target.checked))}
          />{' '}
          Metrónomo
        </label>
        <label>
          <input
            type="checkbox"
            checked={countIn}
            onChange={(event) => change(() => setCountIn(event.target.checked))}
          />{' '}
          Cuenta de entrada
        </label>
        <label>
          <input type="checkbox" checked={follow} onChange={(event) => setFollow(event.target.checked)} /> Seguir
          partitura
        </label>
        <button
          type="button"
          disabled={!count}
          onClick={() => onPlay({ start: first, end: last, speed, repeat, metronome, countIn, bar, beat })}
        >
          Practicar fragmento
        </button>
        {playing && (
          <button type="button" onClick={onStop}>
            Detener práctica
          </button>
        )}
      </div>
      <p className={styles.hint}>La velocidad no cambia la tonalidad ni el tempo guardado. La cuenta dura un compás.</p>
    </details>
  );
}
