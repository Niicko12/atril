import { useState } from 'react';
import { canShareFiles, saveBlob, shareBlob } from '@/infra/download';
import { selectEffectiveView, selectInstrument, useScoreStore } from '@/modules/editor';
import { Overlay, buttonStyles as b } from '@/shared/components/overlay';
import { fileName } from '../services/file-names';
import { S } from '../strings';

type ReadyPdf = { blob: Blob; name: string; title: string };
function WhatsAppDialog({ pdf, close }: { pdf: ReadyPdf; close(): void }) {
  const [message, setMessage] = useState('');
  const [sharing, setSharing] = useState(false);
  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      if ((await shareBlob(pdf.name, pdf.blob, pdf.title)) === 'shared') close();
    } catch {
      setMessage(S.whatsappFailed);
    } finally {
      setSharing(false);
    }
  };
  return (
    <Overlay title="Compartir por WhatsApp" closeLabel={S.close} onClose={close}>
      <p>{S.whatsappHelp}</p>
      {canShareFiles() && (
        <button type="button" className={`${b.btn} ${b.primary}`} disabled={sharing} onClick={() => void share()}>
          {S.whatsappChoose}
        </button>
      )}
      <p>{S.whatsappManual}</p>
      <button type="button" className={b.btn} onClick={() => saveBlob(pdf.name, pdf.blob)}>
        {S.pdf}
      </button>
      <a
        className={b.btn}
        href={`https://wa.me/?text=${encodeURIComponent(S.whatsappText(pdf.title))}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {S.whatsappOpen}
      </a>
      {message && <p role="alert">{message}</p>}
    </Overlay>
  );
}
export function WhatsAppButton({ disabled }: { disabled: boolean }) {
  const [pdf, setPdf] = useState<ReadyPdf | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const prepare = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const state = useScoreStore.getState();
    const instrument = selectInstrument(state);
    try {
      const { scorePdf } = await import('../services/pdf.service');
      const blob = await scorePdf(state.score, instrument, selectEffectiveView(state));
      setPdf({
        blob,
        name: fileName(state.score.title, instrument, 'pdf'),
        title: state.score.title || 'Partitura de Atril',
      });
    } catch {
      setError(S.failed);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className={b.btn} disabled={disabled || busy} onClick={() => void prepare()}>
        {busy ? S.preparingPdf : 'WhatsApp'}
      </button>
      {error && <span role="alert">{error}</span>}
      {pdf && <WhatsAppDialog pdf={pdf} close={() => setPdf(null)} />}
    </>
  );
}
