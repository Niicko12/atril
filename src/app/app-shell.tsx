import { useEffect, useMemo, useRef } from 'react';
import abcjs from 'abcjs';
import { SAMPLES, buildAbc, getInstrument, keyName, measureCount, meterOf } from '@/core';
import styles from './app-shell.module.css';

/** Pantalla base de la semana 1: muestra un ejemplo dibujado con el núcleo portado. */
export function AppShell() {
  const target = useRef<HTMLDivElement>(null);
  const sample = SAMPLES[0];
  const instrument = getInstrument('piano');
  const built = useMemo(() => (sample ? buildAbc(sample, instrument, 'written') : null), [sample, instrument]);

  useEffect(() => {
    if (!target.current || !built) return;
    const width = Math.max(260, target.current.clientWidth - 30);
    abcjs.renderAbc(target.current, built.abc, {
      staffwidth: width,
      paddingleft: 0,
      paddingright: 0,
      wrap: { minSpacing: 1.5, maxSpacing: 2.6, preferredMeasuresPerLine: width < 480 ? 2 : width < 720 ? 3 : 4 },
      foregroundColor: '#16181a',
    });
  }, [built]);

  return (
    <main className={styles.wrap}>
      <header className={styles.brand}>
        <h1>Atril</h1>
        <p>Escribe, escucha y transporta partituras para tu instrumento</p>
      </header>
      <section className={styles.paper} aria-label="Partitura">
        <div ref={target} />
      </section>
      {sample && (
        <p className={styles.status}>
          {sample.title} · {sample.notes.length} notas · {measureCount(sample.notes, meterOf(sample.meter))} compases ·{' '}
          {keyName(sample.key)} · versión en construcción
        </p>
      )}
    </main>
  );
}
