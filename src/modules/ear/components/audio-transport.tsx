import { buttonStyles as b } from '@/shared/components/overlay';
import { PlayIcon } from '@/shared/components/icons';
import type { AudioPlayer, PlayerState } from '../services/audio-player';
import { formatTime } from '../services/peaks';
import { S } from '../strings';
import styles from './ear.module.css';

interface Props {
  player: AudioPlayer;
  state: PlayerState;
  duration: number;
}

/** ▶, −3 s, velocidad, Desde aquí, Hasta aquí, Quitar repetición y tiempo (ear-spec 5.3). */
export function AudioTransport({ player, state, duration }: Props) {
  const hasLoop = state.a != null && state.b != null;
  const from = () => player.setLoop(state.pos, state.b != null && state.b > state.pos + 0.3 ? state.b : state.pos + 4);
  const to = () => player.setLoop(state.a != null && state.a < state.pos - 0.3 ? state.a : state.pos - 4, state.pos);
  return (
    <div className={styles.row}>
      <button
        type="button"
        className={`${b.btn} ${styles.iconBtn}`}
        aria-label={state.playing ? S.pause : S.play}
        onClick={() => (state.playing ? player.stop() : void player.play())}
      >
        <PlayIcon playing={state.playing} />
      </button>
      <button
        type="button"
        className={b.btn}
        title={S.backTitle}
        onClick={() => player.update({ pos: Math.max(0, state.pos - 3) })}
      >
        {S.back}
      </button>
      <select
        className={styles.select}
        aria-label={S.speed}
        value={state.speed}
        onChange={(e) => player.update({ speed: Number(e.target.value) })}
      >
        {S.speeds.map(([v, label]) => (
          <option key={v} value={v}>
            {label}
          </option>
        ))}
      </select>
      <button type="button" className={b.btn} onClick={from}>
        {S.from}
      </button>
      <button type="button" className={b.btn} onClick={to}>
        {S.to}
      </button>
      {hasLoop && (
        <button type="button" className={b.btn} onClick={() => player.update({ a: null, b: null })}>
          {S.clear}
        </button>
      )}
      {hasLoop && <span className={styles.loop}>{S.loop(formatTime(state.a ?? 0), formatTime(state.b ?? 0))}</span>}
      {state.preparing && <span className={styles.muted}>{S.slowPrep}</span>}
      <span className={styles.time}>
        {formatTime(state.pos)} / {formatTime(duration)}
      </span>
    </div>
  );
}
