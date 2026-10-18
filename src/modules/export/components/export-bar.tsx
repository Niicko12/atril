import { useMemo, useRef, useState } from 'react';
import { buildAbc } from '@/core';
import { canShareFiles, saveBlob, shareBlob } from '@/infra/download';
import { selectEffectiveView, selectInstrument, useScoreStore } from '@/modules/editor';
import { buttonStyles as b } from '@/shared/components/overlay';
import { toast } from '@/shared/toast';
import { fileName } from '../services/file-names';
import { S } from '../strings';
import { ImageOverlay } from './image-overlay';
import styles from './export.module.css';

/** PDF, ZIP MuseScore, imagen, ABC y compartir (formats-spec 6-10). */
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
  const pdf = (share: boolean) =>
    run(async () => {
      toast(S.preparingPdf);
      const { scorePdf } = await import('../services/pdf.service');
      const blob = await scorePdf(score, instrument, view).catch(() => Promise.reject(new Error(S.libFailed)));
      if (share && (await shareBlob(name('pdf'), blob, score.title)) === 'shared') toast(S.shared);
      else if (!share) saveBlob(name('pdf'), blob);
      if (!share) toast(S.done(name('pdf')));
    });
  const zip = () =>
    run(async () => {
      const { museScoreZip } = await import('../services/zip.service');
      saveBlob(name('zip'), museScoreZip(score, instrument));
      toast(S.done(name('zip')));
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
      <button type="button" className={b.btn} disabled={busy} onClick={() => void pdf(false)}>
        {S.pdf}
      </button>
      {canShareFiles() && (
        <button type="button" className={b.btn} disabled={busy} onClick={() => void pdf(true)}>
          {S.share}
        </button>
      )}
      <button type="button" className={b.btn} disabled={busy} onClick={() => void zip()}>
        {S.zip}
      </button>
      <button type="button" className={b.btn} disabled={busy} onClick={() => void img()}>
        {S.image}
      </button>
      <button type="button" className={b.btn} onClick={() => void copyAbc()}>
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
