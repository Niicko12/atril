import { useMemo, useRef, useState } from 'react';
import { buildAbc } from '@/core';
import { saveBlob } from '@/infra/download';
import { selectEffectiveView, selectInstrument, useScoreStore } from '@/modules/editor';
import { buttonStyles as b } from '@/shared/components/overlay';
import { toast } from '@/shared/toast';
import { fileName } from '../services/file-names';
import { S } from '../strings';
import { WhatsAppButton } from './whatsapp-button';
import { ImageOverlay } from './image-overlay';
import styles from './export.module.css';

/** PDF, imagen, texto ABC y WhatsApp. */
export function ExportBar() {
  const score = useScoreStore((s) => s.score);
  const instrument = useScoreStore(selectInstrument);
  const view = useScoreStore(selectEffectiveView);
  const [busy, setBusy] = useState(false);
  const [image, setImage] = useState<Blob | null>(null);
  const details = useRef<HTMLDetailsElement>(null);
  const abc = useMemo(
    () => buildAbc(score, instrument, view, { names: score.showNames }).abc,
    [score, instrument, view],
  );
  const name = (ext: string) => fileName(score.title, instrument, ext);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    try {
      await task();
    } catch {
      toast(S.failed);
    } finally {
      setBusy(false);
    }
  };
  const pdf = () =>
    run(async () => {
      toast(S.preparingPdf);
      const { scorePdf } = await import('../services/pdf.service');
      const blob = await scorePdf(score, instrument, view);
      saveBlob(name('pdf'), blob);
      toast(S.done(name('pdf')));
    });
  const img = () =>
    run(async () => {
      const { canvasToBlob, renderCanvas } = await import('../services/render-canvas');
      setImage(await canvasToBlob(await renderCanvas(score, instrument, view)));
    });
  const copyAbc = () =>
    navigator.clipboard?.writeText(abc).then(
      () => toast(S.abcCopied),
      () => details.current && ((details.current.open = true), toast(S.abcSelect)),
    );

  return (
    <section className={styles.bar} aria-label="Exportar">
      <button type="button" className={`${b.btn} ${styles.downloadPdf}`} disabled={busy} onClick={() => void pdf()}>
        {S.pdf}
      </button>
      <WhatsAppButton disabled={busy} />
      <button type="button" className={`${b.btn} ${styles.exportAction}`} disabled={busy} onClick={() => void img()}>
        {S.image}
      </button>
      <button type="button" className={`${b.btn} ${styles.exportAction}`} onClick={() => void copyAbc()}>
        {S.copyAbc}
      </button>
      <details ref={details} className={styles.details}>
        <summary>{S.abcDetails}</summary>
        <textarea className={styles.code} readOnly value={abc} aria-label={S.abcDetails} />
      </details>
      {image && <ImageOverlay blob={image} name={name('png')} onClose={() => setImage(null)} />}
    </section>
  );
}
