import { useState } from 'react';
import { Overlay, buttonStyles as b } from '@/shared/components/overlay';
import { errorMessage, LIMITS, openImported, parseAbcText, parseFile } from '../services/import.service';
import { S } from '../strings';
import { PhotoScan } from './photo-scan';
import { SongCatalog } from './song-catalog';
import styles from './import.module.css';

/** Abrir archivo, enlaces a sitios y pegar ABC (formats-spec 16). Sin "Pedir a Claude" (R1). */
export function FindOverlay({ onClose }: { onClose(): void }) {
  const [fileMsg, setFileMsg] = useState<{ text: string; err: boolean } | null>(null);
  const [abc, setAbc] = useState('');
  const [abcErr, setAbcErr] = useState('');
  const open = async (file: File | undefined) => {
    if (!file) return;
    setFileMsg({ text: S.opening(file.name), err: false });
    try {
      const { result, source } = parseFile(file.name, new Uint8Array(await file.arrayBuffer()));
      if (await openImported(result, source, file.name.replace(/\.[^.]+$/, ''))) onClose();
    } catch (e) {
      setFileMsg({ text: errorMessage(e), err: true });
    }
  };
  const openText = async () => {
    const text = abc.trim();
    if (!text) return setAbcErr(S.pasteFirst);
    if (text.length > LIMITS.abcPaste) return setAbcErr(S.tooLong);
    try {
      if (await openImported(parseAbcText(text).result, 'abc', '')) onClose();
    } catch (e) {
      setAbcErr(errorMessage(e));
    }
  };

  return (
    <Overlay title={S.title} closeLabel={S.close} onClose={onClose}>
      <SongCatalog onLoaded={onClose} />
      <details className={styles.optional}>
        <summary>{S.photoImport}</summary>
        <PhotoScan />
      </details>
      <div className={styles.block}>
        <h3>{S.openFile}</h3>
        <p className={styles.muted}>{S.openHelp}</p>
        <label className={`${b.btn} ${styles.file}`}>
          {S.chooseFile}
          <input
            type="file"
            accept=".musicxml,.xml,.mxl,.mid,.midi,.abc,.txt"
            onChange={(e) => void open(e.target.files?.[0])}
          />
        </label>
        {fileMsg && (
          <p className={fileMsg.err ? styles.err : styles.muted} aria-live="polite">
            {fileMsg.text}
          </p>
        )}
      </div>
      <div className={styles.block}>
        <h3>{S.pasteAbc}</h3>
        <p className={styles.muted}>{S.pasteHelp}</p>
        <textarea
          className={styles.code}
          aria-label={S.pasteAbc}
          placeholder={'X:1\nT:Título\nM:4/4\nL:1/8\nK:G\nGABc dedB|...'}
          value={abc}
          onChange={(e) => {
            setAbc(e.target.value);
            setAbcErr('');
          }}
        />
        <button type="button" className={b.btn} onClick={() => void openText()}>
          {S.openText}
        </button>
        {abcErr && (
          <p className={styles.err} aria-live="polite">
            {abcErr}
          </p>
        )}
      </div>
    </Overlay>
  );
}
