import { useState } from 'react';
import { INSTRUMENTS, METER_IDS, TEMPO_MAX, TEMPO_MIN, keyOptionLabel, type InstrumentId, type MeterId } from '@/core';
import { useScoreStore } from '../store/score.store';
import { S } from '../strings';
import styles from './form.module.css';

const KEYS = Array.from({ length: 13 }, (_, i) => i - 6);

/** Tempo: vacío o no numérico → 100; fuera de rango → recorta (editor-spec 10.1). */
export const parseTempo = (raw: string): number => {
  const n = Math.round(Number(raw));
  return raw.trim() && Number.isFinite(n) ? Math.min(TEMPO_MAX, Math.max(TEMPO_MIN, n)) : 100;
};

export function ScoreMetaForm() {
  const score = useScoreStore((s) => s.score);
  const setMeta = useScoreStore((s) => s.setMeta);
  // Borrador del tempo mientras se escribe; se aplica al salir del campo o con Enter.
  const [draft, setDraft] = useState<string | null>(null);
  const commitTempo = () => {
    if (draft === null) return;
    const t = parseTempo(draft);
    setDraft(null);
    if (t !== score.tempo) setMeta({ tempo: t });
  };
  return (
    <section className={styles.meta} aria-label={S.metaLabel}>
      <div className={`${styles.field} ${styles.wide}`}>
        <label htmlFor="title">{S.fields.title}</label>
        <input
          id="title"
          type="text"
          autoComplete="off"
          maxLength={120}
          value={score.title}
          onChange={(e) => setMeta({ title: e.target.value })}
        />
      </div>
      <div className={`${styles.field} ${styles.wide}`}>
        <label htmlFor="composer">{S.fields.composer}</label>
        <input
          id="composer"
          type="text"
          autoComplete="off"
          maxLength={120}
          value={score.composer}
          onChange={(e) => setMeta({ composer: e.target.value })}
        />
      </div>
      <div className={styles.field}>
        <label htmlFor="instr">{S.fields.instrument}</label>
        <select
          id="instr"
          value={score.instrumentId}
          onChange={(e) => setMeta({ instrumentId: e.target.value as InstrumentId })}
        >
          {INSTRUMENTS.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="key">{S.fields.key}</label>
        <select id="key" value={score.key} onChange={(e) => setMeta({ key: Number(e.target.value) })}>
          {KEYS.map((f) => (
            <option key={f} value={f}>
              {keyOptionLabel(f)}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="meter">{S.fields.meter}</label>
        <select id="meter" value={score.meter} onChange={(e) => setMeta({ meter: e.target.value as MeterId })}>
          {METER_IDS.map((m) => (
            <option key={m} value={m}>
              {m === '4/4' ? S.meterCommon : m}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="tempo">{S.fields.tempo}</label>
        <input
          id="tempo"
          type="number"
          min={TEMPO_MIN}
          max={TEMPO_MAX}
          step={1}
          inputMode="numeric"
          value={draft ?? String(score.tempo)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitTempo}
          onKeyDown={(e) => e.key === 'Enter' && commitTempo()}
        />
      </div>
    </section>
  );
}
