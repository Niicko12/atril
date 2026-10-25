import { useEffect, useRef, useState } from 'react';
import { buttonStyles as b } from '@/shared/components/overlay';
import { useAudioPlayer } from '../hooks/use-audio-player';
import { useFollowAudio } from '../hooks/use-follow-audio';
import { PartsList } from './parts-list';
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

function LoadMessage({ value }: { value: { text: string; err: boolean } | null }) {
  return (
    value && (
      <span className={`${styles.msg} ${value.err ? styles.err : ''}`} aria-live="polite">
        {value.text}
      </span>
    )
  );
}

function AnalysisNotices({ followDisabled, slow }: { followDisabled: boolean; slow: boolean }) {
  return (
    <>
      {followDisabled && (
        <p className={styles.muted} role="status">
          {S.followDisabled}
        </p>
      )}
      {slow && <p className={styles.muted}>{S.slowBackend}</p>}
    </>
  );
}

/** Panel "De oído": audio, onda, transporte y "Escribir la melodía sola" (ear-spec 3-6, 23). */
export function EarPanel({ onClose }: { onClose(): void }) {
  const [audio, setAudio] = useState<DecodedAudio | null>(null);
  const [withChords, setWithChords] = useState(true);
  const loadVersion = useRef(0);
  useEffect(
    () => () => {
      loadVersion.current++;
    },
    [],
  );
  const [mode, setMode] = useState<EarMode>('solo');
  const [loadMsg, setLoadMsg] = useState<{ text: string; err: boolean } | null>(null);
  const { player, state } = useAudioPlayer(audio);
  const analysis = useEarAnalysis();
  const followDisabled = useFollowAudio(player);
  const hasSession = useEarSession((s) => s.session !== null);

  const choose = async (file: File | undefined) => {
    if (!file) return;
    const version = ++loadVersion.current;
    analysis.cancel();
    player?.stop();
    useEarSession.getState().set(null);
    setLoadMsg({ text: S.opening, err: false });
    try {
      const decoded = await decodeFile(file);
      if (version !== loadVersion.current) return;
      setAudio(decoded);
      setLoadMsg(null);
    } catch (e) {
      if (version !== loadVersion.current) return;
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
  const msg = analysis.state.kind === 'running' || analysis.state.kind === 'idle' ? null : analysis.state;

  return (
    <section className={styles.ear} aria-label={S.title}>
      <div className={styles.head}>
        <h2>{S.title}</h2>
        <button
          type="button"
          className={b.btn}
          onClick={() => {
            loadVersion.current++;
            analysis.cancel();
            useEarSession.getState().set(null);
            onClose();
          }}
        >
          {S.close}
        </button>
      </div>
      <ul className={styles.tips}>
        <li>{S.tipSolo}</li>
        <li>{S.tipMix}</li>
        <li>{S.tipParts}</li>
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
        <LoadMessage value={loadMsg} />
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
          <AnalysisNotices followDisabled={followDisabled} slow={analysis.slow} />
          <AnalysisControls
            mode={mode}
            state={analysis.state}
            hasSession={hasSession}
            onMode={setMode}
            onDetect={detect}
            onCancel={analysis.cancel}
            onRequantize={reajustar}
          />
          {analysis.parts && (
            <PartsList
              analysis={analysis.parts}
              withChords={withChords}
              disabled={analysis.state.kind === 'running'}
              onChords={(value) => {
                setWithChords(value);
                useEarSession.getState().setChords(value);
              }}
              onOpen={(part) => {
                player.stop();
                void analysis.open(audio, part, withChords);
              }}
            />
          )}
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
