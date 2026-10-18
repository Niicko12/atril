import { InputDock } from '@/modules/editor';
import { ScoreSheet, ScoreStatus } from '@/modules/score-view';
import { Toast } from '@/shared/toast';
import styles from './app-shell.module.css';

/** Layout de atril: cabecera, hoja, estado y dock de entrada (editor-spec 2). */
export function AppShell() {
  return (
    <>
      <main className={styles.wrap}>
        <header className={styles.brand}>
          <h1>Atril</h1>
          <p>Escribe, escucha y transporta partituras para tu instrumento</p>
        </header>
        <ScoreSheet />
        <ScoreStatus />
        <Toast />
      </main>
      <InputDock />
    </>
  );
}
