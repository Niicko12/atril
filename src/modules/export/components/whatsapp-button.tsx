import { useState } from 'react';
import { selectEffectiveView, selectInstrument, useScoreStore } from '@/modules/editor';
import { buttonStyles as b } from '@/shared/components/overlay';
import { fileName } from '../services/file-names';
import { S } from '../strings';
import { pdfFailure } from '../services/pdf-errors';
import { WhatsAppDialog, type ReadyPdf } from './whatsapp-dialog';
import styles from './whatsapp.module.css';

export function WhatsAppButton({ disabled }: { disabled: boolean }) {
  const [pdf, setPdf] = useState<ReadyPdf | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const prepare = async () => {
    if (busy) return;
    setOpen(true);
    setPdf(null);
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
    } catch (cause) {
      setError(pdfFailure(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className={`${b.btn} ${styles.whatsapp}`}
        aria-busy={busy}
        disabled={disabled || busy}
        onClick={() => void prepare()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3 20.5l1.4-4.7a8.5 8.5 0 1 1 16.1-4.2Z" />
          <path d="M8.2 7.2c-.7.4-.8 1.3-.5 2.2 1 2.9 3.1 5 6 6 .9.3 1.8.2 2.2-.5l.5-1.2-2.5-1.2-.9 1c-1.5-.6-2.7-1.8-3.3-3.3l1-.9-1.2-2.5Z" />
        </svg>
        {busy ? S.preparingPdf : 'WhatsApp'}
      </button>
      {open && <WhatsAppDialog pdf={pdf} error={error} close={() => setOpen(false)} retry={() => void prepare()} />}
    </>
  );
}
