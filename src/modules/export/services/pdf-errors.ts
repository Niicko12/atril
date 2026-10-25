/** Reduce el fallo frecuente de precarga dinámica a instrucciones directas para quien edita. */
export function pdfFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (/failed to fetch dynamically imported module|jspdf/i.test(message))
    return 'No se pudo cargar el generador del PDF. Recarga Atril y vuelve a intentarlo.';
  return 'No se pudo generar el PDF. Revisa la partitura y vuelve a intentarlo.';
}
