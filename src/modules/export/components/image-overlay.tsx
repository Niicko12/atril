import { useEffect, useState } from 'react';
import { canShareFiles, saveBlob, shareBlob } from '@/infra/download';
import { Overlay, buttonStyles as b } from '@/shared/components/overlay';
import { S } from '../strings';
import styles from './export.module.css';

interface Props {
  blob: Blob;
  name: string;
  onClose(): void;
}

/** Imagen PNG para guardar, copiar o compartir (formats-spec 8.2). */
export function ImageOverlay({ blob, name, onClose }: Props) {
  const [url] = useState(() => URL.createObjectURL(blob));
  const [msg, setMsg] = useState('');
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  const copy = () =>
    navigator.clipboard?.write([new ClipboardItem({ 'image/png': blob })]).then(
      () => setMsg(S.imageCopied),
      () => setMsg(S.imageHelp),
    ) ?? setMsg(S.imageHelp);
  return (
    <Overlay title={S.imageTitle} closeLabel={S.close} onClose={onClose}>
      <p className={styles.muted}>{S.imageHelp}</p>
      <img className={styles.img} src={url} alt={S.imageAlt} />
      <div className={styles.row}>
        <button type="button" className={`${b.btn} ${b.primary}`} onClick={() => saveBlob(name, blob)}>
          {S.downloadImage}
        </button>
        <button type="button" className={b.btn} onClick={() => void copy()}>
          {S.copyImage}
        </button>
        {canShareFiles() && (
          <button
            type="button"
            className={b.btn}
            onClick={() => void shareBlob(name, blob, 'Atril').catch(() => setMsg(S.failed))}
          >
            {S.share}
          </button>
        )}
        <span className={styles.muted} aria-live="polite">
          {msg}
        </span>
      </div>
    </Overlay>
  );
}
