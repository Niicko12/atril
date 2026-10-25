/** No recoge contenido del usuario ni identificadores; solo consulta disponibilidad de APIs. */
export function diagnostic(): string {
  const features = {
    'Audio en el navegador': 'AudioContext' in window || 'webkitAudioContext' in window,
    'Guardado local': 'indexedDB' in window,
    'Procesos de análisis': 'Worker' in window,
    'Canvas fuera del hilo principal': 'OffscreenCanvas' in window,
    'Contexto seguro': window.isSecureContext === true,
  };
  return [
    'Atril · diagnóstico local',
    ...Object.entries(features).map(([name, enabled]) => `${name}: ${enabled ? 'disponible' : 'no disponible'}`),
  ].join('\n');
}
export async function copyDiagnostic(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
