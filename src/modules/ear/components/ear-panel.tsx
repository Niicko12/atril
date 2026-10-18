import { useState } from 'react';
import { buttonStyles as b } from '@/shared/components/overlay';
import { useAudioPlayer } from '../hooks/use-audio-player';
import { useEarAnalysis } from '../hooks/use-ear-analysis';
import { decodeFile, EarError, regionOf, requantize } from '../services/ear.service';
import { formatTime } from '../services/peaks';
import { useEarSession } from '../store/ear-session.store';
import { S } from '../strings';
import type { DecodedAudio, EarMode } from '../types';
import { AnalysisControls } from './analysis-controls';
import { AudioTransport } from './audio-transport';
import { Waveform } from './waveform';
import styles from './ear.module.css';

/** Panel "De oído": audio, onda, transporte y "Escribir la melodía sola" (ear-spec 3-6, 23). */
export function EarPanel({ onClose }: { onClose(): void }) {
  const [audio, setAudio] = useState<DecodedAudio | null>(null);
  const [mode, setMode] = useState<EarMode>('solo');
  const [loadMsg, setLoadMsg] = useState<{ text: string; err: boolean } | null>(null);
  const { player, state } = useAudioPlayer(audio);
  const analysis = useEarAnalysis();
  const hasSession = useEarSession((s) => s.session !== null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    analysis.cancel();
    setLoadMsg({ text: S.opening, err: false });
    try {
      setAudio(await decodeFile(file));
      setLoadMsg(null);
    } catch (e) {
      setLoadMsg({ text: e instanceof EarError ? e.message : S.errDecode, err: true });
    }
  };
  const detect = () => {
    if (!audio) return;
    player?.stop();
    void analysis.run(audio, mode, regionOf(audio.duration, state.a, state.b));
  };
  const reajustar = () => {
    const bpm = requantize();
    if (bpm) analysis.setState({ kind: 'done', message: S.requantDone(bpm) });
  };
  const msg = analysis.state.kind === 'done' || analysis.state.kind === 'error' ? analysis.state : null;

  return (
    <section className={styles.ear} aria-label={S.title}>
      <div className={styles.head}>
        <h2>{S.title}</h2>
        <button
          type="button"
          className={b.btn}
          onClick={() => {
            analysis.cancel();
            onClose();
          }}
        >
          {S.close}
        </button>
      </div>
      <ul className={styles.tips}>
        <li>{S.tipSolo}</li>
        <li>{S.tipMix}</li>
        <li>{S.tipEar}</li>
      </ul>
      <span className={styles.privacy}>{S.privacy}</span>
      <div className={styles.row}>
        <label className={`${b.btn} ${styles.file}`}>
          {S.choose}
          <input
            type="file"
            accept="audio/*,video/*,.m4a,.mp3,.wav,.aac,.ogg,.caf"
            onChange={(e) => void choose(e.target.files?.[0])}
          />
        </label>
        {audio && (
          <span className={styles.muted}>
            {audio.name} · {formatTime(audio.duration)}
          </span>
        )}
        {loadMsg && (
          <span className={`${styles.msg} ${loadMsg.err ? styles.err : ''}`} aria-live="polite">
            {loadMsg.text}
          </span>
        )}
      </div>
      {audio && player && (
        <>
          <Waveform
            mono={audio.mono}
            duration={audio.duration}
            state={state}
            onSeek={(pos) => player.update({ pos })}
            onLoop={(a, bb) => player.setLoop(a, bb)}
          />
          <AudioTransport player={player} state={state} duration={audio.duration} />
          <AnalysisControls
            mode={mode}
            state={analysis.state}
            hasSession={hasSession}
            onMode={setMode}
            onDetect={detect}
            onCancel={analysis.cancel}
            onRequantize={reajustar}
          />
        </>
      )}
      {msg && (
        <p className={`${styles.msg} ${msg.kind === 'error' ? styles.err : styles.ok}`} aria-live="polite">
          {msg.message}
        </p>
      )}
    </section>
  );
}
