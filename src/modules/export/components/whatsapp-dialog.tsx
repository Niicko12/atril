import { useState } from 'react';
import { canShareFiles, saveBlob, shareBlob } from '@/infra/download';
import { Overlay, buttonStyles as b } from '@/shared/components/overlay';
import { S } from '../strings';
import styles from './whatsapp.module.css';

export type ReadyPdf = { blob: Blob; name: string; title: string };
interface Props {
  pdf: ReadyPdf | null;
  error: string;
  close(): void;
  retry(): void;
}

interface ActionProps {
  pdf: ReadyPdf;
  sharing: boolean;
  share(): void;
  downloadAndOpen(): void;
}

function ShareAction({ pdf, sharing, share, downloadAndOpen }: ActionProps) {
  if (canShareFiles(pdf.name, pdf.blob))
    return (
      <>
        <p>Abre el menú y elige WhatsApp para enviar la partitura.</p>
        <button type="button" className={`${b.btn} ${styles.whatsapp}`} disabled={sharing} onClick={share}>
          {sharing ? 'Abriendo menú…' : S.whatsappChoose}
        </button>
      </>
    );
  return (
    <>
      <p>El PDF se descargará y WhatsApp se abrirá para que lo adjuntes.</p>
      <button type="button" className={`${b.btn} ${styles.whatsapp}`} onClick={downloadAndOpen}>
        Descargar PDF y abrir WhatsApp
      </button>
    </>
  );
}

export function WhatsAppDialog({ pdf, error, close, retry }: Props) {
  const [message, setMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const share = async () => {
    if (!pdf || sharing) return;
    setSharing(true);
    setMessage('');
    try {
      if ((await shareBlob(pdf.name, pdf.blob, pdf.title)) === 'shared') close();
    } catch {
      setMessage(S.whatsappFailed);
    } finally {
      setSharing(false);
    }
  };
  const href = `https://wa.me/?text=${encodeURIComponent(S.whatsappText(pdf?.title ?? 'Atril'))}`;
  const downloadAndOpen = () => {
    if (!pdf) return;
    window.open(href, '_blank', 'noopener,noreferrer');
    saveBlob(pdf.name, pdf.blob);
    setMessage('PDF descargado. En WhatsApp, elige el contacto y adjunta el archivo desde Descargas.');
  };
  return (
    <Overlay title="Compartir por WhatsApp" closeLabel={S.close} onClose={close}>
      {!pdf && !error && (
        <p role="status" aria-live="polite">
          Preparando tu partitura en PDF…
        </p>
      )}
      {error && (
        <>
          <p role="alert">{error}</p>
          <button className={b.btn} onClick={retry}>
            Volver a intentar
          </button>
        </>
      )}
      {pdf && (
        <div className={styles.panel}>
          <div className={styles.file}>
            <span aria-hidden="true">PDF</span>
            <div>
              <strong>{pdf.title}</strong>
              <small>Partitura lista para compartir</small>
            </div>
          </div>
          <ShareAction pdf={pdf} sharing={sharing} share={() => void share()} downloadAndOpen={downloadAndOpen} />
        </div>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
    </Overlay>
  );
}
