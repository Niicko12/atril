import { useEffect, useRef, useState } from 'react';
import { saveBlob } from '@/infra/download';
import { buttonStyles as b } from '@/shared/components/overlay';
import styles from './import.module.css';

/** Prepara una foto local para un motor OMR y guía el retorno por MusicXML. */
export function PhotoScan() {
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const [rotation, setRotation] = useState(0);
  const [contrast, setContrast] = useState(120);
  const [brightness, setBrightness] = useState(108);
  const [message, setMessage] = useState('');
  const [preparing, setPreparing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  const choosePhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setMessage('Elige una foto JPG, PNG o WebP de la partitura.');
    if (file.size > 25 * 1024 * 1024) return setMessage('La imagen supera 25 MB. Reduce su tamaño antes de continuar.');
    setPhoto((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { file, url: URL.createObjectURL(file) };
    });
    setRotation(0);
    setMessage('La foto se procesa en este dispositivo; no se envía a un servidor.');
  };

  const downloadPrepared = async () => {
    if (!photo || preparing) return;
    setPreparing(true);
    setMessage('Preparando imagen…');
    try {
      const image = new Image();
      image.src = photo.url;
      await image.decode();
      const sideways = Math.abs(rotation % 180) === 90;
      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvas.width = sideways ? image.naturalHeight : image.naturalWidth;
      canvas.height = sideways ? image.naturalWidth : image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas');
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((rotation * Math.PI) / 180);
      context.filter = `grayscale(1) contrast(${contrast}%) brightness(${brightness}%)`;
      context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
      context.restore();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('encode'))), 'image/png'),
      );
      saveBlob(`${photo.file.name.replace(/\.[^.]+$/, '')}-partitura.png`, blob);
      setMessage('Imagen lista. Ábrela en Audiveris, revisa las notas reconocidas y exporta como .mxl.');
    } catch {
      setMessage('No se pudo preparar esta imagen. Prueba con otra foto JPG o PNG.');
    } finally {
      setPreparing(false);
    }
  };

  return (
    <div className={styles.block}>
      <h3>Digitalizar desde una foto</h3>
      <p className={styles.muted}>
        Sube una foto de una partitura impresa, enderézala y mejora el contraste. Después usa Audiveris para reconocer
        las notas y exportar MusicXML; vuelve a Atril y abre el archivo .mxl para editar y escuchar la canción.
      </p>
      <label className={`${b.btn} ${styles.file}`}>
        {photo ? 'Cambiar foto' : 'Elegir foto de partitura'}
        <input type="file" accept="image/*" capture="environment" onChange={(e) => choosePhoto(e.target.files?.[0])} />
      </label>
      {photo && (
        <>
          <div className={styles.photoPreview}>
            <img
              src={photo.url}
              alt="Vista previa de la partitura fotografiada"
              style={{ filter: `grayscale(1) contrast(${contrast}%) brightness(${brightness}%)`, transform: `rotate(${rotation}deg)` }}
            />
          </div>
          <div className={styles.photoControls}>
            <button type="button" className={b.btn} onClick={() => setRotation((value) => (value + 90) % 360)}>Girar 90°</button>
            <label>Contraste <input type="range" min="80" max="220" value={contrast} onChange={(e) => setContrast(Number(e.target.value))} /></label>
            <label>Brillo <input type="range" min="70" max="150" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} /></label>
          </div>
          <button type="button" className={b.btn} onClick={() => void downloadPrepared()} disabled={preparing}>
            {preparing ? 'Preparando…' : 'Descargar imagen mejorada'}
          </button>
          <div className={styles.scanSteps}>
            <b>Flujo de digitalización</b>
            <ol>
              <li>Descarga la imagen mejorada.</li>
              <li><a href="https://audiveris.github.io/audiveris/" target="_blank" rel="noopener noreferrer">Ábrela en Audiveris ↗</a> y ejecuta el reconocimiento.</li>
              <li>Revisa la partitura reconocida y expórtala como MusicXML (.mxl).</li>
              <li>Abre aquí el .mxl con «Elegir archivo» para continuar editando y reproducirlo.</li>
            </ol>
            <p className={styles.muted}>El reconocimiento funciona mejor con partituras impresas y fotos enfocadas. Audiveris no reconoce escritura a mano; revisa siempre el resultado antes de editar.</p>
          </div>
        </>
      )}
      {message && <p className={styles.muted} aria-live="polite">{message}</p>}
      <canvas ref={canvasRef} className={styles.hiddenCanvas} aria-hidden="true" />
    </div>
  );
}
