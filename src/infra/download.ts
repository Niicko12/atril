// Descargar y compartir archivos (formats-spec 10).
export function saveBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export function canShareFiles(filename = 'x.txt', blob = new Blob([''], { type: 'text/plain' })): boolean {
  try {
    const probe = new File([blob], filename, { type: blob.type });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

/** Menú de compartir del sistema (WhatsApp, Drive…). Cancelar no es error. */
export async function shareBlob(filename: string, blob: Blob, title: string): Promise<'shared' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type });
  try {
    await navigator.share({ files: [file], title });
    return 'shared';
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
    throw e;
  }
}
