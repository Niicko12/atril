import { EAR_LIMITS } from '@/core/analysis';

/** Duración legible a partir de las constantes (ear-spec 22.2: ningún texto con duraciones literales). */
export function humanDuration(sec: number): string {
  if (sec === 90) return 'minuto y medio';
  if (sec % 60 === 0) return `${sec / 60} ${sec === 60 ? 'minuto' : 'minutos'}`;
  return `${sec} segundos`;
}

const MB = 1024 * 1024;

export const S = {
  title: 'De oído',
  open: 'De oído',
  close: 'Cerrar',
  tipSolo:
    '«Que se escriba solo»: graba una nota de voz cantando («la la la») o tocando la melodía, una nota a la vez, súbela y pulsa «Escribir la melodía sola».',
  tipMix: `«Canción completa»: sube el audio (MP3, M4A o un video de tu teléfono) y elige «solo la voz». Funciona mejor con pedazos de hasta ${humanDuration(EAR_LIMITS.mixMaxSec)}.`,
  tipEar:
    '«Sacarla de oído»: sube el audio, selecciona un pedazo arrastrando sobre la onda, ponlo más lento y escribe las notas con el teclado de abajo.',
  privacy: 'Tu audio no sale de tu teléfono.',
  choose: 'Elegir audio',
  opening: 'Abriendo audio…',
  waveLabel: 'Onda del audio: toca para mover, arrastra para repetir un pedazo',
  play: 'Reproducir audio',
  pause: 'Pausar audio',
  back: '−3 s',
  backTitle: 'Atrás 3 segundos',
  speed: 'Velocidad',
  speeds: [
    [1, 'Velocidad normal'],
    [0.9, '90 %'],
    [0.8, '80 %'],
    [0.7, '70 %'],
    [0.6, '60 %'],
    [0.5, '50 % (mitad)'],
  ] as const,
  from: 'Desde aquí',
  to: 'Hasta aquí',
  clear: 'Quitar repetición',
  loop: (a: string, b: string) => `Repite ${a}–${b}`,
  slowPrep: 'Preparando audio lento…',
  modes: { solo: 'Una voz o un instrumento solo', mix: 'Canción completa: solo la voz (más rápido)' },
  modeLabel: 'Tipo de audio',
  detect: 'Escribir la melodía sola',
  cancel: 'Cancelar',
  requant: 'Reajustar ritmo al tempo',
  listeningSolo: (p: number) => `Escuchando la melodía… ${p} %`,
  listeningMix: (p: number) => `Buscando la voz principal… ${p} %`,
  cut: (sec: number) => `Analicé los primeros ${humanDuration(sec)}; selecciona otro pedazo para seguir.`,
  done: (n: number, bpm: number, draft: boolean) =>
    `Listo: ${n} notas a ♩ = ${bpm}. Escúchala con ▶. ${draft ? 'Es un borrador: compara con el audio y corrige las notas que no coincidan. ' : ''}Si el ritmo quedó raro, cambia el Tempo arriba y pulsa «Reajustar ritmo al tempo».`,
  requantDone: (bpm: number) => `Ritmo reajustado a ♩ = ${bpm}.`,
  titleSuffix: ' (de oído)',
  defaultTitle: 'Melodía',
  errDecode: 'No se pudo leer ese audio. Prueba con MP3, M4A (notas de voz) o WAV.',
  errSize: `El audio es demasiado grande (máximo ${EAR_LIMITS.fileMaxBytes / MB} MB). Recórtalo e inténtalo de nuevo.`,
  errDuration: `El audio dura más de ${humanDuration(EAR_LIMITS.durationMaxSec)}. Recórtalo e inténtalo de nuevo.`,
  errNoNotesSolo:
    'No encontré notas claras. Usa una grabación de una sola voz o instrumento, sin acompañamiento y sin ruido. Si es una canción completa, elige «Canción completa».',
  errNoNotesMix: 'No encontré una melodía clara. Prueba seleccionando solo un pedazo donde se oiga bien la voz.',
  errMemory: 'Ese pedazo es demasiado largo para este teléfono. Selecciona uno más corto.',
  errInternal: 'No se pudo analizar el audio. Prueba con un pedazo más corto.',
} as const;
