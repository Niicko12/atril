/** Título y compositor: sin saltos de línea ni `%` (comentario en ABC, D2), máximo 120. */
export function escapeAbcText(text: string): string {
  return text.replace(/[\r\n]/g, ' ').replace(/%/g, '').slice(0, 120);
}

/** Cifrado de acorde: sin comillas, máximo 12. */
export function escapeAnnotation(text: string): string {
  return text.replace(/"/g, '').slice(0, 12);
}
